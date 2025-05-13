import React, { FC, useEffect, useState } from 'react';
import { collection, onSnapshot, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../providers/useAuth';
import { IReport } from '../../../types';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, MenuItem, Popover } from '@mui/material';
import * as XLSX from 'xlsx';
import FilterListIcon from '@mui/icons-material/FilterList';

interface ReportsProps {
    categoryFilter: string;
    setCategoryFilter: (filter: string) => void;
}

interface ColumnFilter {
    [key: string]: string;
}

interface TableColumn {
    name: string;
    label: string;
    isCheck?: boolean;
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
    const { db, user } = useAuth();
    const [error, setError] = useState('');
    const [reports, setReports] = useState<IReport[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const reportsPerPage = 5;
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [columnFilters, setColumnFilters] = useState<ColumnFilter>({});
    const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
    const [currentFilterColumn, setCurrentFilterColumn] = useState<string>('');

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

    const columns: TableColumn[] = [
        { name: 'customer', label: 'Заказчик' },
        { name: 'division', label: 'Подразделение' },
        { name: 'work', label: 'Вид работ' },
        { name: 'nameTY', label: 'Наименование ТУ' },
        { name: 'regTY', label: 'рег №ТУ' },
        { name: 'zavTY', label: 'зав №ТУ' },
        { name: 'YZT', label: 'УЗТ', isCheck: true },
        { name: 'VIK', label: 'ВИК', isCheck: true },
        { name: 'CD', label: 'ЦД', isCheck: true },
        { name: 'YZK', label: 'УЗК', isCheck: true },
        { name: 'TV', label: 'ТВ', isCheck: true },
        { name: 'RK', label: 'РК', isCheck: true },
        { name: 'result', label: 'Результат' },
        { name: 'defect', label: 'Дефект' },
        { name: 'login', label: 'Логин создателя' },
    ];

    const handleFilterClick = (event: React.MouseEvent<HTMLElement>, columnName: string) => {
        setCurrentFilterColumn(columnName);
        setFilterAnchorEl(event.currentTarget);
    };

    const handleFilterClose = () => {
        setFilterAnchorEl(null);
    };

    const handleFilterChange = (columnName: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [columnName]: value
        }));
        setCurrentPage(0);
        handleFilterClose();
    };

    const clearFilter = (columnName: string) => {
        const newFilters = {...columnFilters};
        delete newFilters[columnName];
        setColumnFilters(newFilters);
        setCurrentPage(0);
    };

    const applyFilters = (data: IReport[]) => {
        return data.filter(report => {
            return Object.entries(columnFilters).every(([column, filterValue]) => {
                if (!filterValue) return true;
                
                const columnConfig = columns.find(c => c.name === column);
                let reportValue;
                
                if (columnConfig?.isCheck) {
                    // Для чек-боксов преобразуем в "Да" или "-"
                    reportValue = report[column as keyof IReport] && 
                                Object.keys(report[column as keyof IReport] as object).length > 0 ? 
                                'Да' : '-';
                } else {
                    reportValue = report[column as keyof IReport];
                }
                
                if (reportValue === undefined || reportValue === null) return false;
                
                return String(reportValue).toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    };

    const getUniqueValues = (columnName: string) => {
        const columnConfig = columns.find(c => c.name === columnName);
        
        if (columnConfig?.isCheck) {
            // Для чек-боксов возвращаем только "Да" и "-"
            return ['Да', '-'];
        }
        
        const values = new Set<string>();
        reports.forEach(report => {
            const value = report[columnName as keyof IReport];
            if (value !== undefined && value !== null) {
                values.add(String(value));
            }
        });
        return Array.from(values).sort();
    };

    const filteredReports = applyFilters(reports).filter((report, index) => {
        const reportNumber = (currentPage * reportsPerPage) + index + 1;
        return reportNumber.toString().includes(searchTerm);
    });

    const currentReports = filteredReports.slice(currentPage * reportsPerPage, (currentPage + 1) * reportsPerPage);
    const totalPages = Math.ceil(filteredReports.length / reportsPerPage);

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

    const deleteSelectedReports = async (reportId: string) => {
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
        selectedReports.forEach(report => {
            deleteSelectedReports(report.id);
        });
    };

    const openSelectedReport = () => {
        const selectedReports = reports.filter(report => report.selected);
        const selectedReportId = selectedReports[0]?.id;
        if (selectedReportId) {
            window.open(`/report/${selectedReportId}`, '_blank');
        }
    };

    const handlePageChange = (direction: 'next' | 'prev') => {
        setCurrentPage(prev => direction === 'next' ? Math.min(prev + 1, totalPages - 1) : Math.max(prev - 1, 0));
    };

    const goToStart = () => {
        setCurrentPage(0);
    };

    const goToEnd = () => {
        setCurrentPage(totalPages - 1);
    };

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
                    <Button variant="contained" onClick={downloadSelectedReport} style={{ marginRight: 8 }} disabled={!reports.some(r => r.selected)}>
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
                    color="error"
                >
                    Удалить выбранные отчеты
                </Button>
            </div>

            <TableContainer component={Paper} style={{ width: '100%', marginBottom: 20 }}>
                <Table style={{ width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Чек бокс</TableCell>
                            <TableCell>п/п</TableCell>
                            {columns.map((column) => (
                                <TableCell key={column.name}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {column.label}
                                        <span
                                            style={{ 
                                                cursor: 'pointer', 
                                                color: columnFilters[column.name] ? '#1976d2' : 'inherit',
                                                marginLeft: 5,
                                                display: 'inline-flex',
                                                alignItems: 'center'
                                            }}
                                            onClick={(e: React.MouseEvent<HTMLElement>) => handleFilterClick(e, column.name)}
                                        >
                                            <FilterListIcon fontSize="small" />
                                            {columnFilters[column.name] && (
                                                <span 
                                                    style={{ 
                                                        marginLeft: 5, 
                                                        cursor: 'pointer',
                                                        color: 'red',
                                                        fontSize: '0.8rem'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        clearFilter(column.name);
                                                    }}
                                                >
                                                    ×
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </TableCell>
                            ))}
                            <TableCell>Номер отчета</TableCell>
                            <TableCell>Дата и время</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {currentReports.map((report, index) => (
                            <TableRow key={report.id} hover>
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        checked={!!report.selected}
                                        onChange={() => handleSelectReport(report.id)}
                                    />
                                </TableCell>
                                <TableCell>{report.n}</TableCell>
                                {columns.map((column) => (
                                    <TableCell key={`${report.id}-${column.name}`}>
                                        {column.isCheck ? 
                                            (report[column.name as keyof IReport] && 
                                            Object.keys(report[column.name as keyof IReport] as object).length > 0 ? 
                                            'Да' : '-') :
                                            (report[column.name as keyof IReport] !== undefined ? 
                                                String(report[column.name as keyof IReport]) : 
                                                '-')}
                                    </TableCell>
                                ))}
                                <TableCell>{report.number}</TableCell>
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

            <Popover
                open={Boolean(filterAnchorEl)}
                anchorEl={filterAnchorEl}
                onClose={handleFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <div style={{ padding: '10px', minWidth: '200px' }}>
                    <TextField
                        select
                        fullWidth
                        value={columnFilters[currentFilterColumn] || ''}
                        onChange={(e) => handleFilterChange(currentFilterColumn, e.target.value)}
                        label={`Фильтр по ${columns.find(c => c.name === currentFilterColumn)?.label}`}
                        size="small"
                    >
                        <MenuItem value="">
                            <em>Все значения</em>
                        </MenuItem>
                        {getUniqueValues(currentFilterColumn).map((value) => (
                            <MenuItem key={value} value={value}>
                                {value}
                            </MenuItem>
                        ))}
                    </TextField>
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => clearFilter(currentFilterColumn)}
                            disabled={!columnFilters[currentFilterColumn]}
                        >
                            Очистить
                        </Button>
                    </div>
                </div>
            </Popover>

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