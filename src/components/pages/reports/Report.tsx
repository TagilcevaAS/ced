import React, { FC, useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../providers/useAuth';
import { IReport, IDataPoint, ReportsProps } from '../../../types';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Box } from '@mui/material';
import * as XLSX from 'xlsx';
import { useParams } from 'react-router-dom';
import { ChangeEvent } from 'react';

const Report: FC<ReportsProps> = ({ categoryFilter, setCategoryFilter }) => {
    const { id } = useParams<{ id: string }>();
    const { db, user } = useAuth();
    const [reports, setReports] = useState<IReport[]>([]);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editedValues, setEditedValues] = useState<Record<string, Partial<IReport>>>({});

    const generateExcel = useCallback((data: IReport[], filename: string) => {
        const worksheetData = data.map((report) => ({
            "п/п": report.n,
            "Заказчик": report.customer,
            "Подразделение": report.division,
            "Вид работ": report.work,
            "Наименование ТУ": report.nameTY,
            "Рег №ТУ": report.regTY,
            "Зав №ТУ": report.zavTY,
            "УЗТ": report.YZT && Object.keys(report.YZT).length > 0 ? 'Да' : '-',
            "ВИК": report.VIK && Object.keys(report.VIK).length > 0 ? 'Да' : '-',
            "ЦД": report.CD && Object.keys(report.CD).length > 0 ? 'Да' : '-',
            "УЗК": report.YZK && Object.keys(report.YZK).length > 0 ? 'Да' : '-',
            "ТВ": report.TV && Object.keys(report.TV).length > 0 ? 'Да' : '-',
            "РК": report.RK && Object.keys(report.RK).length > 0 ? 'Да' : '-',
            "Результат": report.result,
            "Дефект": report.defect,
            "Номер отчета": report.number,
            "Логин создателя": report.login,
            "Дата и время": report.createdAt instanceof Timestamp ? (
                new Intl.DateTimeFormat('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                }).format(report.createdAt.toDate())
            ) : ('Нет даты')
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
        XLSX.writeFile(workbook, filename);
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'unsubmitted_reports'), (snapshot) => {
            const reportData = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data() as Omit<IReport, 'id'>
                }))
                .filter(report => id === report.id && (categoryFilter === '' || report.customer.includes(categoryFilter)));

            setReports(reportData);
        });

        return () => unsub();
    }, [db, categoryFilter, id]);

    const downloadSelectedReport = useCallback(() => {
        generateExcel(reports, 'reports.xlsx');
    }, [reports, generateExcel]);

    const deleteSelectedReports = useCallback(async (reportId: string) => {
        try {
            await deleteDoc(doc(db, 'unsubmitted_reports', reportId));
            setReports(prev => prev.filter(report => report.id !== reportId));
        } catch (error) {
            console.error('Error deleting report:', error);
        }
    }, [db]);

    const handleDeleteClick = useCallback(() => {
        if (user?.email !== 'admin@gmail.com') return;
        reports.forEach(report => {
            if (report.selected) deleteSelectedReports(report.id);
        });
    }, [reports, deleteSelectedReports, user]);

    const handleEditClick = useCallback((reportId: string) => {
        if (user?.email === 'admin@gmail.com') {
            setEditingReportId(reportId);
        }
    }, [user]);

    const handleSaveClick = useCallback(async (reportId: string) => {
        try {
            const reportToUpdate = reports.find(report => report.id === reportId);
            if (!reportToUpdate) return;

            const updatedValues = editedValues[reportId] || {};
            const reportRef = doc(db, 'unsubmitted_reports', reportId);

            await updateDoc(reportRef, updatedValues);
            setEditingReportId(null);
            setEditedValues({});
        } catch (error) {
            console.error('Error updating report:', error);
        }
    }, [reports, editedValues, db]);

    const handleCancelClick = useCallback(() => {
        setEditingReportId(null);
        setEditedValues({});
    }, []);

    const handleInputChange = useCallback((
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        reportId: string,
        field: keyof IReport
    ) => {
        const value = event.target.value;
        setEditedValues(prev => ({
            ...prev,
            [reportId]: {
                ...prev[reportId],
                [field]: value,
            },
        }));
    }, []);

    const handleChange = useCallback((
        reportId: string,
        dataPointKey: keyof IReport,
        field: 'a' | 'b' | 'c' | 'd',
        index: number,
        value: string
    ) => {
        setReports(prev => prev.map(report => {
            if (report.id !== reportId) return report;

            const currentDataPoint = report[dataPointKey];
            if (!currentDataPoint || typeof currentDataPoint !== 'object') return report;

            const dataPoint = { ...currentDataPoint as IDataPoint };

            const currentFieldValue = dataPoint[field];

            let currentArray: string[];
            if (typeof currentFieldValue === 'string') {
                currentArray = currentFieldValue.split(';').map(item => item.trim());
            } else if (Array.isArray(currentFieldValue)) {
                currentArray = currentFieldValue.flatMap(v =>
                    typeof v === 'string' ? v.split(';').map(item => item.trim()) : []
                );
            } else {
                currentArray = [];
            }

            const updatedArray = [...currentArray];
            updatedArray[index] = value;

            const updatedValue = updatedArray.join(';');

            return {
                ...report,
                [dataPointKey]: {
                    ...dataPoint,
                    [field]: updatedValue
                }
            };
        }));
    }, []);

    const addDataRow = useCallback((reportId: string, dataPointKey: keyof IReport) => {
        setReports(prev => prev.map(report => {
            if (report.id !== reportId) return report;

            const currentDataPoint = report[dataPointKey] as IDataPoint | undefined;

            const addEmptyToField = (fieldValue: string | string[] | undefined): string => {
                if (!fieldValue) return ';';
                if (typeof fieldValue === 'string') return `${fieldValue};`;
                return [...fieldValue, ''].join(';');
            };

            return {
                ...report,
                [dataPointKey]: {
                    a: addEmptyToField(currentDataPoint?.a),
                    b: addEmptyToField(currentDataPoint?.b),
                    c: addEmptyToField(currentDataPoint?.c),
                    d: addEmptyToField(currentDataPoint?.d),
                }
            };
        }));
    }, []);

    const renderDataPoints = useCallback((dataPoint: IDataPoint | undefined, reportId: string, dataPointKey: keyof IReport) => {
        if (!dataPoint) return null;

        const splitValues = (fieldValue: string | string[] | undefined): string[] => {
            if (!fieldValue) return [];
            if (typeof fieldValue === 'string') return fieldValue.split(';').map(item => item.trim());
            return fieldValue.flatMap(v =>
                typeof v === 'string' ? v.split(';').map(item => item.trim()) : []
            );
        };

        const a = splitValues(dataPoint.a);
        const b = splitValues(dataPoint.b);
        const c = splitValues(dataPoint.c);
        const d = splitValues(dataPoint.d);
        const maxLength = Math.max(a.length, b.length, c.length, d.length);

        return (
            <>
                {Array.from({ length: maxLength }, (_, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            <TextField
                                value={a[index] || ''}
                                onChange={(e) => handleChange(reportId, dataPointKey, 'a', index, e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                value={b[index] || ''}
                                onChange={(e) => handleChange(reportId, dataPointKey, 'b', index, e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                value={c[index] || ''}
                                onChange={(e) => handleChange(reportId, dataPointKey, 'c', index, e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                            />
                        </TableCell>
                        {dataPointKey === 'TV' && (
                            <TableCell>
                                <TextField
                                    value={d[index] || ''}
                                    onChange={(e) => handleChange(reportId, dataPointKey, 'd', index, e.target.value)}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                />
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </>
        );
    }, [handleChange]);

    const renderHeaderRow = (label: string, field: keyof Omit<IReport, 'YZT' | 'VIK' | 'CD' | 'YZK' | 'TV' | 'RK'>) => (
        <TableRow>
            <TableCell>{label}</TableCell>
            {reports.map(report => (
                <TableCell key={report.id}>
                    {editingReportId === report.id && user?.email === 'admin@gmail.com' ? (
                        <TextField
                            defaultValue={report[field] as string}
                            onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                                handleInputChange(e, report.id, field)}
                        />
                    ) : (
                        report[field] as string
                    )}
                </TableCell>
            ))}
        </TableRow>
    );

    const renderTableSection = (
        title: string,
        dataPointKey: keyof Pick<IReport, 'YZT' | 'VIK' | 'CD' | 'YZK' | 'TV' | 'RK'>,
        headers: string[],
        hasDColumn = false
    ) => (
        <div style={{ flex: 1, marginRight: '10px' }}>
            <TableContainer component={Paper} style={{ width: '100%' }}>
                <Table style={{ width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell colSpan={hasDColumn ? 4 : 3} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                {title}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {headers.map(header => (
                                <TableCell key={header}>{header}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {reports.map(report => (
                            <React.Fragment key={report.id}>
                                {renderDataPoints(report[dataPointKey] as IDataPoint | undefined, report.id, dataPointKey)}
                                {editingReportId === report.id && (
                                    <TableRow>
                                        <TableCell colSpan={hasDColumn ? 4 : 3} align="center">
                                            <Button
                                                variant="outlined"
                                                onClick={() => addDataRow(report.id, dataPointKey)}
                                            >
                                                Добавить строку
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );

    const isAdmin = user?.email === 'admin@gmail.com';

    return (
        <div>
            <TableContainer style={{ width: '30%', marginRight: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Table style={{ width: '100%' }}>
                        <TableBody>
                            {renderHeaderRow('Заказчик', 'customer')}
                            {renderHeaderRow('Подразделение', 'division')}
                            {renderHeaderRow('Вид работ', 'work')}
                            {renderHeaderRow('Наименование ТУ', 'nameTY')}
                            {renderHeaderRow('Рег номер', 'regTY')}
                            {renderHeaderRow('Зав номер', 'zavTY')}
                            <TableRow>
                                <TableCell>Логин создателя</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>{report.login}</TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Дата</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {report.createdAt instanceof Timestamp ? (
                                            new Intl.DateTimeFormat('ru-RU', {
                                                day: 'numeric', month: 'long', year: 'numeric',
                                                hour: 'numeric', minute: 'numeric',
                                            }).format(report.createdAt.toDate())
                                        ) : 'Нет даты'}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Номер отчета</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>{report.number}</TableCell>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </TableContainer>

            <Box style={{ marginBottom: 15, display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                <Button variant="contained" onClick={downloadSelectedReport}>
                    Выгрузить отчет в эксель
                </Button>
                <Box display="flex" gap={1}>
                    {reports.map(report => (
                        <Button
                            key={report.id}
                            variant="contained"
                            onClick={() => handleEditClick(report.id)}
                            disabled={!isAdmin || (editingReportId !== null && editingReportId !== report.id)}
                        >
                            Редактировать
                        </Button>
                    ))}
                    <Button
                        variant="contained"
                        onClick={handleDeleteClick}
                        disabled={!isAdmin}
                        color="error"
                    >
                        Удалить
                    </Button>
                </Box>
                {editingReportId && isAdmin && (
                    <Box display="flex" gap={1}>
                        <Button variant="contained" onClick={() => handleSaveClick(editingReportId)}>
                            Сохранить
                        </Button>
                        <Button variant="contained" onClick={handleCancelClick}>
                            Отменить
                        </Button>
                    </Box>
                )}
            </Box>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                {renderTableSection('УЗТ', 'YZT', ['№точки', '№элемента', 'Результат замера'])}
                {renderTableSection('ВИК', 'VIK', ['№стыка/участка', 'Обнаруженные дефекты', 'Результат'])}
                {renderTableSection('ЦД', 'CD', ['№стыка/участка', 'Обнаруженные дефекты', 'Результат'])}
                {renderTableSection('УЗК', 'YZK', ['№стыка/участка', 'Дефект', 'Результат'])}
                {renderTableSection('ТВ', 'TV', ['№стыка/участка', 'Осн. мет', 'ЗТО', 'Шов'], true)}
                {renderTableSection('РК', 'RK', ['№стыка/участка', 'Дефект', 'Результат'])}
            </div>
        </div>
    );
};

export default Report;