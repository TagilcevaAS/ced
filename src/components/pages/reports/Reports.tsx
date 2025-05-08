import React, { FC, useEffect, useState } from 'react';
import { collection, onSnapshot, Timestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../providers/useAuth';
import { IReport } from '../../../types';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import * as XLSX from 'xlsx';

interface ReportsProps {
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

const Reports: FC<ReportsProps> = ({ categoryFilter, setCategoryFilter }) => {
    const { db } = useAuth();
    const { user, ga } = useAuth();
    const [error, setError] = useState('');
    const [reports, setReports] = useState<IReport[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const reportsPerPage = 5;
    const [searchTerm, setSearchTerm] = useState<string>('');
    
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'unsubmitted_reports'), (snapshot) => {
            const reportData: IReport[] = [];
            const updates: Promise<void>[] = [];
    
            snapshot.forEach((docSnapshot) => {
                const report = {
                    id: docSnapshot.id,
                    ...docSnapshot.data() as Omit<IReport, 'id'>
                };
    
                if (categoryFilter === '' || report.customer.includes(categoryFilter)) {
                    reportData.push(report);
                    updates.push(updateDoc(doc(db, 'unsubmitted_reports', docSnapshot.id), {
                        n: reportData.length.toString(),
                        number: (reportData.length + 1000).toString()
                    }));
                }
            });
    
            Promise.all(updates).catch(error => {
                console.error("Error updating documents:", error);
            });
    
            setReports(reportData);
        }, (error) => {
            setError(error.message);
        });
    
        return () => {
            unsub();
        };
    }, [db, categoryFilter]);


    const handleSelectReport = (reportId: string) => {
        setReports(prevReports =>
            prevReports.map(report =>
                report.id === reportId ? { ...report, selected: !report.selected } : report
            )
        );
    };

    const downloadSelectedReport = () => {
        const selectedReports = reports.filter(report => report.selected);
        generateExcel(selectedReports, 'selected_reports.xlsx');
    };

    const downloadJournalReports = () => {
        generateExcel(reports, 'journal_reports.xlsx');
    };

    const deleteSelectedReports = async (reportId: string, userId: string) => {
        if (user?.email !== 'admin@gmail.com') {
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
        const selectedReports = reports.filter(r => r.selected);
        const userId = user?._id;
        if (!userId) {
            console.log('User ID is undefined');
            return;
        }
        selectedReports.forEach(report => {
            deleteSelectedReports(report.id, userId);
        });
    };

    const openSelectedReport = () => {
        const selectedReports = reports.filter(report => report.selected);
        const selectedReportId = selectedReports[0].id;
        window.open(`/report/${selectedReportId}`, '_blank');
    };

    const totalPages = Math.ceil(reports.length / reportsPerPage);
    const currentReports = reports.slice(currentPage * reportsPerPage, (currentPage + 1) * reportsPerPage);

    const handlePageChange = (direction: 'next' | 'prev') => {
        setCurrentPage(prev => direction === 'next' ? Math.min(prev + 1, totalPages - 1) : Math.max(prev - 1, 0));
    };

    const goToStart = () => {
        setCurrentPage(0);
    };

    const goToEnd = () => {
        setCurrentPage(totalPages - 1);
    };

    const filteredReports = reports.filter((report, index) => {
        const reportNumber = (currentPage * reportsPerPage) + index + 1;
        return reportNumber.toString().includes(searchTerm);
    });

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            const reportNumber = parseInt(searchTerm);
            if (!isNaN(reportNumber)) {
                const pageIndex = Math.floor((reportNumber - 1) / reportsPerPage);
                if (pageIndex >= 0 && pageIndex < totalPages) {
                    setCurrentPage(pageIndex);
                }
            }
        }
    };

    return (
        <>
            <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <Button variant="contained" onClick={openSelectedReport} style={{ marginRight: 8 }} disabled={!reports.some(r => r.selected)}>
                        Открыть отчет
                    </Button>
                    <Button variant="contained" onClick={downloadSelectedReport} style={{ marginRight: 8 }}>
                        Выгрузить выбранный отчет в эксель
                    </Button>
                    <Button variant="contained" onClick={downloadJournalReports}>
                        Выгрузить журнал отчетов в эксель
                    </Button>
                </div>
                <Button
                    variant="contained"
                    onClick={handleDeleteClick}
                    disabled={!reports.some(r => r.selected) || user?.email !== 'admin@gmail.com'}
                >
                    Удалить выбранные отчеты
                </Button>
            </div>

            <TableContainer component={Paper} style={{ width: '100%' }}>
                <Table style={{ width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Чек бокс</TableCell>
                            <TableCell>п/п</TableCell>
                            <TableCell>Заказчик</TableCell>
                            <TableCell>Подразделение</TableCell>
                            <TableCell>Вид работ</TableCell>
                            <TableCell>Наименование ТУ</TableCell>
                            <TableCell>рег №ТУ</TableCell>
                            <TableCell>зав №ТУ</TableCell>
                            <TableCell>УЗТ</TableCell>
                            <TableCell>ВИК</TableCell>
                            <TableCell>ЦД</TableCell>
                            <TableCell>УЗК</TableCell>
                            <TableCell>ТВ</TableCell>
                            <TableCell>РК</TableCell>
                            <TableCell>Результат</TableCell>
                            <TableCell>Дефект</TableCell>
                            <TableCell>Номер отчета</TableCell>
                            <TableCell>Логин создателя</TableCell>
                            <TableCell>Дата и время</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {currentReports.map((report, index) => (
                            <TableRow key={report.id}>
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        checked={report.selected}
                                        onChange={() => handleSelectReport(report.id)}
                                    />
                                </TableCell>
                                <TableCell>{(currentPage * reportsPerPage) + index + 1}</TableCell>
                                <TableCell>{report.customer}</TableCell>
                                <TableCell>{report.division}</TableCell>
                                <TableCell>{report.work}</TableCell>
                                <TableCell>{report.nameTY}</TableCell>
                                <TableCell>{report.regTY}</TableCell>
                                <TableCell>{report.zavTY}</TableCell>
                                <TableCell>{report.YZT && Object.keys(report.YZT).length > 0 ? 'Да' : '-'}</TableCell>
                                <TableCell>{report.VIK && Object.keys(report.VIK).length > 0 ? 'Да' : '-'}</TableCell>
                                <TableCell>{report.CD && Object.keys(report.CD).length > 0 ? 'Да' : '-'}</TableCell>
                                <TableCell>{report.YZK && Object.keys(report.YZK).length > 0 ? 'Да' : '-'}</TableCell>
                                <TableCell>{report.TV && Object.keys(report.TV).length > 0 ? 'Да' : '-'}</TableCell>
                                <TableCell>{report.RK && Object.keys(report.RK).length > 0 ? 'Да' : '-'}</TableCell>
                                <TableCell>{report.result}</TableCell>
                                <TableCell>{report.defect}</TableCell>
                                <TableCell>{(currentPage * reportsPerPage) + index + 1001}</TableCell>
                                <TableCell>{report.login}</TableCell>
                                <TableCell>{report.createdAt instanceof Timestamp ? (
                                    new Intl.DateTimeFormat('ru-RU', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: 'numeric',
                                    }).format(report.createdAt.toDate())
                                ) : ('Нет даты')}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>

                </Table>
            </TableContainer>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button onClick={goToStart} disabled={currentPage <= 0} style={{ marginRight: '10px' }}>
                    &#9664;&#9664;
                </button>
                <button onClick={() => handlePageChange('prev')} disabled={currentPage <= 0} style={{ marginRight: '10px' }}>
                    &#9664;
                </button>
                <input
                    type="text"
                    placeholder=""
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    style={{ padding: '5px', maxWidth: '20px', marginRight: '10px' }}
                />
                <span>Страница {currentPage + 1} из {totalPages}</span>
                <button onClick={() => handlePageChange('next')} disabled={currentPage >= totalPages - 1} style={{ marginLeft: '10px', marginRight: '10px' }}>
                    &#9654;
                </button>
                <button onClick={goToEnd} disabled={currentPage >= totalPages - 1}>
                    &#9654;&#9654;
                </button>
            </div>
        </>
    );
};

export default Reports;