import React, { FC, useEffect, useState } from 'react';
import { collection, onSnapshot, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../providers/useAuth';
import { IReport, IDataPoint } from '../../../types';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Box } from '@mui/material';
import * as XLSX from 'xlsx';
import { useParams } from 'react-router-dom';
import { ChangeEvent } from 'react';

interface ReportProps {
    categoryFilter: string;
    setCategoryFilter: (filter: string) => void;
}

const generateExcel = (data: IReport[], filename: string) => {
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
};

const Report: FC<ReportProps> = ({ categoryFilter, setCategoryFilter }) => {
    const { id } = useParams<{ id: string }>();
    const { db } = useAuth();
    const { user, ga } = useAuth();
    const [error, setError] = useState('');
    const [reports, setReports] = useState<IReport[]>([]);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editedValues, setEditedValues] = useState<Record<string, Partial<IReport>>>({});

    useEffect(() => {
        const fetchReports = async () => {
            const unsub = onSnapshot(collection(db, 'unsubmitted_reports'), (snapshot) => {
                const reportData: IReport[] = [];

                snapshot.forEach((docSnapshot) => {
                    const report = {
                        id: docSnapshot.id,
                        ...docSnapshot.data() as Omit<IReport, 'id'>
                    };
                    if (id === report.id && (categoryFilter === '' || report.customer.includes(categoryFilter))) {
                        reportData.push(report);
                    }
                });
                setReports(reportData);
            }, (error) => {
                setError(error.message);
            });
            return () => {
                unsub();
            };
        };
        fetchReports();
    }, [db, categoryFilter, id]);

    const downloadSelectedReport = () => {
        generateExcel(reports, 'reports.xlsx');
    };

    const deleteSelectedReports = async (reportId: string, userId: string) => {
        if (userId !== user?._id) {
            console.log('Unauthorized access to delete report');
            return;
        }
        try {
            await deleteDoc(doc(db, 'unsubmitted_reports', reportId));
            setReports((prevReports) => prevReports.filter((report) => report.id !== reportId));
        } catch (error) {
            console.error('Error deleting report:', error);
        }
    };

    const handleDeleteClick = () => {
        const userId = user?.email;
        if (userId !== 'admin@gmail.com') {
            return;
        }
        const selectedReports = reports.filter(r => r.selected);
        if (!userId) {
            console.log('User ID is undefined');
            return;
        }
        selectedReports.forEach(report => {
            deleteSelectedReports(report.id, user._id);
        });
    };

    const handleEditClick = (reportId: string) => {
        if (user?.email === 'admin@gmail.com') {
            setEditingReportId(reportId);
        } else {
            return;
        }
    };

    const handleSaveClick = async (reportId: string) => {
        try {
            // Находим отчет который нужно обновить
            const reportToUpdate = reports.find(report => report.id === reportId);
            if (!reportToUpdate) return;

            // Получаем отредактированные значения
            const updatedValues = editedValues[reportId] || {};

            // Обновляем данные в Firestore
            const reportRef = doc(db, 'unsubmitted_reports', reportId);
            await updateDoc(reportRef, {
                ...reportToUpdate,
                ...updatedValues
            });

            // Сбрасываем состояние редактирования
            setEditingReportId(null);
            setEditedValues({});
        } catch (error) {
            console.error('Error updating report:', error);
        }
    };

    const handleCancelClick = () => {
        setEditingReportId(null);
        setEditedValues({});
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, reportId: string, field: keyof IReport) => {
        const value = event.target.value;
        setEditedValues(prev => ({
            ...prev,
            [reportId]: {
                ...prev[reportId],
                [field]: value,
            },
        }));
    };

    const isAdmin = user?.email === 'admin@gmail.com';

    const handleChange = (
        reportId: string,
        dataPointKey: keyof IReport,
        field: 'a' | 'b' | 'c' | 'd',
        index: number,
        value: string
    ) => {
        setReports(prevReports => {
            return prevReports.map(report => {
                if (report.id === reportId) {
                    const currentDataPoint = report[dataPointKey];
                    if (!currentDataPoint || typeof currentDataPoint !== 'object') {
                        return report;
                    }

                    const dataPoint = { ...currentDataPoint as IDataPoint };
                    const updatedArray = [...(dataPoint[field] || [])];
                    updatedArray[index] = value;

                    return {
                        ...report,
                        [dataPointKey]: {
                            ...dataPoint,
                            [field]: updatedArray
                        }
                    };
                }
                return report;
            });
        });
    };

    const renderDataPoints = (dataPoint: IDataPoint | undefined, reportId: string, dataPointKey: keyof IReport) => {
        if (!dataPoint) return null;

        const a = dataPoint.a || [];
        const b = dataPoint.b || [];
        const c = dataPoint.c || [];
        const d = dataPoint.d || [];
        const maxLength = Math.max(a.length, b.length, c.length, d.length);

        return (
            <>
                {Array.from({ length: maxLength }, (_, index) => (
                    <TableRow key={index}>
                        {/* Поле a - всегда присутствует */}
                        <TableCell>
                            <TextField
                                value={a[index] || ''}
                                onChange={(e) => handleChange(reportId, dataPointKey, 'a', index, e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                            />
                        </TableCell>

                        {/* Поле b - всегда присутствует */}
                        <TableCell>
                            <TextField
                                value={b[index] || ''}
                                onChange={(e) => handleChange(reportId, dataPointKey, 'b', index, e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                            />
                        </TableCell>

                        {/* Поле c - всегда присутствует */}
                        <TableCell>
                            <TextField
                                value={c[index] || ''}
                                onChange={(e) => handleChange(reportId, dataPointKey, 'c', index, e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                            />
                        </TableCell>

                        {/* Поле d - только для определенных типов таблиц */}
                        {(dataPointKey === 'TV') && (
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
    };

    const addDataRow = (reportId: string, dataPointKey: keyof IReport) => {
        setReports(prevReports => {
            return prevReports.map(report => {
                if (report.id === reportId) {
                    const currentDataPoint = report[dataPointKey];
                    if (!currentDataPoint || typeof currentDataPoint !== 'object') {
                        return report;
                    }

                    const dataPoint = { ...currentDataPoint as IDataPoint };

                    return {
                        ...report,
                        [dataPointKey]: {
                            a: [...(dataPoint.a || []), ''],
                            b: [...(dataPoint.b || []), ''],
                            c: [...(dataPoint.c || []), ''],
                            d: [...(dataPoint.d || []), ''],
                        }
                    };
                }
                return report;
            });
        });
    };

    return (
        <div>
            <TableContainer style={{ width: '20%', marginRight: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Table style={{ width: '80%' }}>
                        <TableBody>
                            <TableRow>
                                <TableCell>Заказчик</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {editingReportId === report.id && isAdmin ? (
                                            <TextField
                                                defaultValue={report.customer}
                                                onChange={(e) => handleInputChange(e, report.id, 'customer')}
                                            />
                                        ) : (
                                            report.customer
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Подразделение</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {editingReportId === report.id && isAdmin ? (
                                            <TextField
                                                defaultValue={report.division}
                                                onChange={(e) => handleInputChange(e, report.id, 'division')}
                                            />
                                        ) : (
                                            report.division
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Вид работ</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {editingReportId === report.id && isAdmin ? (
                                            <TextField
                                                defaultValue={report.work}
                                                onChange={(e) => handleInputChange(e, report.id, 'work')}
                                            />
                                        ) : (
                                            report.work
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Наименование ТУ</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {editingReportId === report.id && isAdmin ? (
                                            <TextField
                                                defaultValue={report.nameTY}
                                                onChange={(e) => handleInputChange(e, report.id, 'nameTY')}
                                            />
                                        ) : (
                                            report.nameTY
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Рег номер</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {editingReportId === report.id && isAdmin ? (
                                            <TextField
                                                defaultValue={report.regTY}
                                                onChange={(e) => handleInputChange(e, report.id, 'regTY')}
                                            />
                                        ) : (
                                            report.regTY
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Зав номер</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {editingReportId === report.id && isAdmin ? (
                                            <TextField
                                                defaultValue={report.zavTY}
                                                onChange={(e) => handleInputChange(e, report.id, 'zavTY')}
                                            />
                                        ) : (
                                            report.zavTY
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Логин создателя</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {report.login}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Дата</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {report.createdAt instanceof Timestamp ? (
                                            new Intl.DateTimeFormat('ru-RU', {
                                                day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric',
                                            }).format(report.createdAt.toDate())
                                        ) : ('Нет даты')}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell>Номер отчета</TableCell>
                                {reports.map(report => (
                                    <TableCell key={report.id}>
                                        {report.number}
                                    </TableCell>
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
                    <Button
                        variant="contained"
                        onClick={handleDeleteClick}
                        disabled={user?.email !== 'admin@gmail.com'}
                    >
                        Удалить
                    </Button>
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
                </Box>
                {reports.map(report => {
                    if (editingReportId === report.id && isAdmin) {
                        return (
                            <Box key={report.id} display="flex" gap={1}>
                                <Button
                                    variant="contained"
                                    onClick={() => handleSaveClick(report.id)}
                                >
                                    Сохранить
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleCancelClick}
                                >
                                    Отменить
                                </Button>
                            </Box>
                        );
                    }
                    return null;
                })}
            </Box>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <TableContainer component={Paper} style={{ width: '100%' }}>
                        <Table style={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>УЗТ</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>№точки</TableCell>
                                    <TableCell>№элемента</TableCell>
                                    <TableCell>Результат<br />замера</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map(report => (
                                    <React.Fragment key={report.id}>
                                        {renderDataPoints(report.YZT, report.id, 'YZT')}
                                        {editingReportId === report.id && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center"> {/* Изменили colSpan с 4 на 3 */}
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => addDataRow(report.id, 'YZT')}
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
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <TableContainer component={Paper} style={{ width: '100%' }}>
                        <Table style={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>ВИК</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>№стыка/участка</TableCell>
                                    <TableCell>Обнаруженные дефекты</TableCell>
                                    <TableCell>Результат</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map(report => (
                                    <React.Fragment key={report.id}>
                                        {renderDataPoints(report.VIK, report.id, 'VIK')}
                                        {editingReportId === report.id && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => addDataRow(report.id, 'VIK')}
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
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <TableContainer component={Paper} style={{ width: '100%' }}>
                        <Table style={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>ЦД</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>№стыка/участка</TableCell>
                                    <TableCell>Обнаруженные дефекты</TableCell>
                                    <TableCell>Результат</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map(report => (
                                    <React.Fragment key={report.id}>
                                        {renderDataPoints(report.CD, report.id, 'CD')}
                                        {editingReportId === report.id && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => addDataRow(report.id, 'CD')}
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
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <TableContainer component={Paper} style={{ width: '100%' }}>
                        <Table style={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>УЗК</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>№<br />стыка</TableCell>
                                    <TableCell>Дефект</TableCell>
                                    <TableCell>Результат</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map(report => (
                                    <React.Fragment key={report.id}>
                                        {renderDataPoints(report.YZK, report.id, 'YZK')}
                                        {editingReportId === report.id && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => addDataRow(report.id, 'YZK')}
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
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <TableContainer component={Paper} style={{ width: '100%' }}>
                        <Table style={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell colSpan={4} style={{ textAlign: 'center', fontWeight: 'bold' }}>ТВ</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>№стыка/<br />участка</TableCell>
                                    <TableCell>Осн. мет</TableCell>
                                    <TableCell>ЗТО</TableCell>
                                    <TableCell>Шов</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map(report => (
                                    <React.Fragment key={report.id}>
                                        {renderDataPoints(report.TV, report.id, 'TV')}
                                        {editingReportId === report.id && (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center">
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => addDataRow(report.id, 'TV')}
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
                <div style={{ flex: 1 }}>
                    <TableContainer component={Paper} style={{ width: '100%' }}>
                        <Table style={{ width: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>РК</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>№<br />стыка</TableCell>
                                    <TableCell>Дефект</TableCell>
                                    <TableCell>Результат</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {reports.map(report => (
                                    <React.Fragment key={report.id}>
                                        {renderDataPoints(report.RK, report.id, 'RK')}
                                        {editingReportId === report.id && (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => addDataRow(report.id, 'RK')}
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
            </div>
        </div>
    );
};

export default Report;
