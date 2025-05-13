import React, { FC, useEffect, useState, useMemo, useCallback } from 'react';
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

const COLUMNS: TableColumn[] = [
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

const REPORTS_PER_PAGE = 5;

const formatDate = (timestamp: Timestamp): string => {
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    }).format(timestamp.toDate());
};

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
        "Дата и время": report.createdAt instanceof Timestamp ? formatDate(report.createdAt) : 'Нет даты'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
    XLSX.writeFile(workbook, filename);
};

const Reports: FC<ReportsProps> = ({ categoryFilter }) => {
    const { db, user } = useAuth();
    const [error, setError] = useState('');
    const [reports, setReports] = useState<IReport[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [columnFilters, setColumnFilters] = useState<ColumnFilter>({});
    const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
    const [currentFilterColumn, setCurrentFilterColumn] = useState('');

    // Fetch reports data
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'unsubmitted_reports'), (snapshot) => {
            const reportData: IReport[] = [];
            const updates: Promise<void>[] = [];

            snapshot.forEach((docSnapshot) => {
                const report = {
                    id: docSnapshot.id,
                    ...docSnapshot.data() as Omit<IReport, 'id'>
                };

                if (!categoryFilter || report.customer.includes(categoryFilter)) {
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

        return unsub;
    }, [db, categoryFilter]);

    // Filter handlers
    const handleFilterClick = useCallback((event: React.MouseEvent<HTMLElement>, columnName: string) => {
        setCurrentFilterColumn(columnName);
        setFilterAnchorEl(event.currentTarget);
    }, []);

    const handleFilterClose = useCallback(() => {
        setFilterAnchorEl(null);
    }, []);

    const handleFilterChange = useCallback((columnName: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [columnName]: value
        }));
        setCurrentPage(0);
        handleFilterClose();
    }, [handleFilterClose]);

    const clearFilter = useCallback((columnName: string) => {
        const newFilters = { ...columnFilters };
        delete newFilters[columnName];
        setColumnFilters(newFilters);
        setCurrentPage(0);
    }, [columnFilters]);

    // Filter application
    const filteredReports = useMemo(() => {
        return reports.filter(report => {
            return Object.entries(columnFilters).every(([column, filterValue]) => {
                if (!filterValue) return true;
                
                const columnConfig = COLUMNS.find(c => c.name === column);
                let reportValue;
                
                if (columnConfig?.isCheck) {
                    reportValue = report[column as keyof IReport] && 
                                Object.keys(report[column as keyof IReport] as object).length > 0 ? 
                                'Да' : '-';
                } else {
                    reportValue = report[column as keyof IReport];
                }
                
                if (reportValue === undefined || reportValue === null) return false;
                
                return String(reportValue).toLowerCase().includes(filterValue.toLowerCase());
            });
        }).filter((report, index) => {
            const reportNumber = (currentPage * REPORTS_PER_PAGE) + index + 1;
            return reportNumber.toString().includes(searchTerm);
        });
    }, [reports, columnFilters, currentPage, searchTerm]);

    // Pagination
    const currentReports = useMemo(() => {
        return filteredReports.slice(currentPage * REPORTS_PER_PAGE, (currentPage + 1) * REPORTS_PER_PAGE);
    }, [filteredReports, currentPage]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredReports.length / REPORTS_PER_PAGE);
    }, [filteredReports]);

    // Report selection
    const handleSelectReport = useCallback((reportId: string) => {
        setReports(prevReports =>
            prevReports.map(report =>
                report.id === reportId ? { ...report, selected: !report.selected } : report
            )
        );
    }, []);

    const selectedReports = useMemo(() => reports.filter(report => report.selected), [reports]);

    // Excel export
    const downloadSelectedReport = useCallback(() => {
        generateExcel(selectedReports, 'selected_reports.xlsx');
    }, [selectedReports]);

    const downloadJournalReports = useCallback(() => {
        generateExcel(reports, 'journal_reports.xlsx');
    }, [reports]);

    // Report deletion
    const deleteSelectedReports = useCallback(async () => {
        if (user?.email !== 'admin@gmail.com') return;

        try {
            await Promise.all(selectedReports.map(report => 
                deleteDoc(doc(db, 'unsubmitted_reports', report.id))
            ));
            setReports(prev => prev.filter(report => !report.selected));
        } catch (error) {
            console.error('Error deleting reports:', error);
        }
    }, [selectedReports, db, user]);

    // Navigation
    const openSelectedReport = useCallback(() => {
        const selectedReportId = selectedReports[0]?.id;
        if (selectedReportId) {
            window.open(`/report/${selectedReportId}`, '_blank');
        }
    }, [selectedReports]);

    const handlePageChange = useCallback((direction: 'next' | 'prev') => {
        setCurrentPage(prev => direction === 'next' 
            ? Math.min(prev + 1, totalPages - 1) 
            : Math.max(prev - 1, 0));
    }, [totalPages]);

    const goToStart = useCallback(() => setCurrentPage(0), []);
    const goToEnd = useCallback(() => setCurrentPage(totalPages - 1), [totalPages]);

    const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            const reportNumber = parseInt(searchTerm);
            if (!isNaN(reportNumber)) {
                const pageIndex = Math.floor((reportNumber - 1) / REPORTS_PER_PAGE);
                if (pageIndex >= 0 && pageIndex < totalPages) {
                    setCurrentPage(pageIndex);
                }
            }
        }
    }, [searchTerm, totalPages]);

    // Unique values for filter dropdown
    const getUniqueValues = useCallback((columnName: string) => {
        const columnConfig = COLUMNS.find(c => c.name === columnName);
        
        if (columnConfig?.isCheck) {
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
    }, [reports]);

    return (
        <>
            <ActionButtons
                hasSelected={selectedReports.length > 0}
                isAdmin={user?.email === 'admin@gmail.com'}
                onOpen={openSelectedReport}
                onDownloadSelected={downloadSelectedReport}
                onDownloadAll={downloadJournalReports}
                onDelete={deleteSelectedReports}
            />

            <ReportTable
                reports={currentReports}
                columns={COLUMNS}
                columnFilters={columnFilters}
                onFilterClick={handleFilterClick}
                onSelectReport={handleSelectReport}
            />

            <FilterPopover
                anchorEl={filterAnchorEl}
                currentFilterColumn={currentFilterColumn}
                columns={COLUMNS}
                columnFilters={columnFilters}
                uniqueValuesGetter={getUniqueValues}
                onFilterChange={handleFilterChange}
                onClearFilter={clearFilter}
                onClose={handleFilterClose}
            />

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onKeyPress={handleKeyPress}
                onPageChange={handlePageChange}
                onGoToStart={goToStart}
                onGoToEnd={goToEnd}
            />
        </>
    );
};

// Sub-components for better organization

interface ActionButtonsProps {
    hasSelected: boolean;
    isAdmin: boolean;
    onOpen: () => void;
    onDownloadSelected: () => void;
    onDownloadAll: () => void;
    onDelete: () => void;
}

const ActionButtons: FC<ActionButtonsProps> = ({
    hasSelected,
    isAdmin,
    onOpen,
    onDownloadSelected,
    onDownloadAll,
    onDelete
}) => (
    <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'space-between' }}>
        <div>
            <Button variant="contained" onClick={onOpen} style={{ marginRight: 8 }} disabled={!hasSelected}>
                Открыть отчет
            </Button>
            <Button variant="contained" onClick={onDownloadSelected} style={{ marginRight: 8 }} disabled={!hasSelected}>
                Выгрузить выбранный отчет в эксель
            </Button>
            <Button variant="contained" onClick={onDownloadAll}>
                Выгрузить журнал отчетов в эксель
            </Button>
        </div>
        <Button
            variant="contained"
            onClick={onDelete}
            disabled={!hasSelected || !isAdmin}
            color="error"
        >
            Удалить выбранные отчеты
        </Button>
    </div>
);

interface ReportTableProps {
    reports: IReport[];
    columns: TableColumn[];
    columnFilters: ColumnFilter;
    onFilterClick: (event: React.MouseEvent<HTMLElement>, columnName: string) => void;
    onSelectReport: (reportId: string) => void;
}

const ReportTable: FC<ReportTableProps> = ({
    reports,
    columns,
    columnFilters,
    onFilterClick,
    onSelectReport
}) => (
    <TableContainer component={Paper} style={{ width: '100%', marginBottom: 20 }}>
        <Table style={{ width: '100%' }}>
            <TableHead>
                <TableRow>
                    <TableCell>Чек бокс</TableCell>
                    <TableCell>п/п</TableCell>
                    {columns.map((column) => (
                        <TableCell key={column.name}>
                            <ColumnHeader 
                                column={column}
                                filter={columnFilters[column.name]}
                                onFilterClick={onFilterClick}
                                onClearFilter={() => onFilterClick({} as React.MouseEvent<HTMLElement>, column.name)}
                            />
                        </TableCell>
                    ))}
                    <TableCell>Номер отчета</TableCell>
                    <TableCell>Дата и время</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {reports.map((report) => (
                    <ReportRow 
                        key={report.id}
                        report={report}
                        columns={columns}
                        onSelectReport={onSelectReport}
                    />
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

interface ColumnHeaderProps {
    column: TableColumn;
    filter: string | undefined;
    onFilterClick: (event: React.MouseEvent<HTMLElement>, columnName: string) => void;
    onClearFilter: () => void;
}

const ColumnHeader: FC<ColumnHeaderProps> = ({ column, filter, onFilterClick, onClearFilter }) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
        {column.label}
        <span
            style={{ 
                cursor: 'pointer', 
                color: filter ? '#1976d2' : 'inherit',
                marginLeft: 5,
                display: 'inline-flex',
                alignItems: 'center'
            }}
            onClick={(e: React.MouseEvent<HTMLElement>) => onFilterClick(e, column.name)}
        >
            <FilterListIcon fontSize="small" />
            {filter && (
                <span 
                    style={{ 
                        marginLeft: 5, 
                        cursor: 'pointer',
                        color: 'red',
                        fontSize: '0.8rem'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onClearFilter();
                    }}
                >
                    ×
                </span>
            )}
        </span>
    </div>
);

interface ReportRowProps {
    report: IReport;
    columns: TableColumn[];
    onSelectReport: (reportId: string) => void;
}

const ReportRow: FC<ReportRowProps> = ({ report, columns, onSelectReport }) => (
    <TableRow hover>
        <TableCell>
            <input
                type="checkbox"
                checked={!!report.selected}
                onChange={() => onSelectReport(report.id)}
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
        <TableCell>
            {report.createdAt instanceof Timestamp ? formatDate(report.createdAt) : 'Нет даты'}
        </TableCell>
    </TableRow>
);

interface FilterPopoverProps {
    anchorEl: HTMLElement | null;
    currentFilterColumn: string;
    columns: TableColumn[];
    columnFilters: ColumnFilter;
    uniqueValuesGetter: (columnName: string) => string[];
    onFilterChange: (columnName: string, value: string) => void;
    onClearFilter: (columnName: string) => void;
    onClose: () => void;
}

const FilterPopover: FC<FilterPopoverProps> = ({
    anchorEl,
    currentFilterColumn,
    columns,
    columnFilters,
    uniqueValuesGetter,
    onFilterChange,
    onClearFilter,
    onClose
}) => {
    const columnConfig = columns.find(c => c.name === currentFilterColumn);
    
    return (
        <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
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
                    onChange={(e) => onFilterChange(currentFilterColumn, e.target.value)}
                    label={`Фильтр по ${columnConfig?.label}`}
                    size="small"
                >
                    <MenuItem value="">
                        <em>Все значения</em>
                    </MenuItem>
                    {uniqueValuesGetter(currentFilterColumn).map((value) => (
                        <MenuItem key={value} value={value}>
                            {value}
                        </MenuItem>
                    ))}
                </TextField>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={() => onClearFilter(currentFilterColumn)}
                        disabled={!columnFilters[currentFilterColumn]}
                    >
                        Очистить
                    </Button>
                </div>
            </div>
        </Popover>
    );
};

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onKeyPress: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onPageChange: (direction: 'next' | 'prev') => void;
    onGoToStart: () => void;
    onGoToEnd: () => void;
}

const PaginationControls: FC<PaginationControlsProps> = ({
    currentPage,
    totalPages,
    searchTerm,
    onSearchChange,
    onKeyPress,
    onPageChange,
    onGoToStart,
    onGoToEnd
}) => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button onClick={onGoToStart} disabled={currentPage <= 0} style={{ marginRight: '10px' }}>
            &#9664;&#9664;
        </button>
        <button onClick={() => onPageChange('prev')} disabled={currentPage <= 0} style={{ marginRight: '10px' }}>
            &#9664;
        </button>
        <input
            type="text"
            placeholder=""
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyPress={onKeyPress}
            style={{ padding: '5px', maxWidth: '20px', marginRight: '10px' }}
        />
        <span>Страница {currentPage + 1} из {totalPages}</span>
        <button onClick={() => onPageChange('next')} disabled={currentPage >= totalPages - 1} style={{ marginLeft: '10px', marginRight: '10px' }}>
            &#9654;
        </button>
        <button onClick={onGoToEnd} disabled={currentPage >= totalPages - 1}>
            &#9654;&#9654;
        </button>
    </div>
);

export default Reports;