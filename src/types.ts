import { Dispatch, SetStateAction, ReactNode } from "react";
import { Auth } from "firebase/auth";
import { Firestore } from "firebase/firestore";
import { Timestamp } from 'firebase/firestore';

export type TypeSetState<T> = Dispatch<SetStateAction<T>>

export interface IUser {
    _id: string
    name: string
    email?: string
}

export interface IUserData {
    email: string
    password: string
}

export interface IContext {
    user: IUser | null
    setUser: TypeSetState<IUser | null>
    ga: Auth
    db: Firestore
    updateUser: (updatedUser: IUser) => void
}

export interface AuthContextProps {
    children: ReactNode
}

export interface IDataPoint {
    a?: string | string[];
    b?: string | string[];
    c?: string | string[];
    d?: string | string[];
}

export interface IReport {
    id: string;
    field: boolean;
    n: number;
    customer: string;
    division: string;
    work: string;
    nameTY: string;
    regTY: string;
    zavTY: string;
    YZT?: IDataPoint;
    VIK?: IDataPoint;
    CD?: IDataPoint;
    YZK?: IDataPoint;
    TV?: IDataPoint;
    RK?: IDataPoint;
    result: string;
    defect?: string;
    number: string;
    login: string;
    selected: boolean;
    createdAt: Timestamp | Date;
    serialNumber?: number;
}

export interface ReportsProps {
    categoryFilter: string;
    setCategoryFilter: (filter: string) => void;
}

export interface ColumnFilter {
    [key: string]: string;
}

export interface TableColumn {
    name: string;
    label: string;
    isCheck?: boolean;
}