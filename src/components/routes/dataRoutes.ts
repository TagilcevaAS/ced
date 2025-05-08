import Auth from "../pages/auth/Auth";
import Main from "../pages/main/Main";
import Reports from "../pages/reports/Reports";
import Report from "../pages/reports/Report";

export const routes = [
    {
        path: '/',
        exact: true,
        component: Main,
        auth: true,
    },
    {
        path: '/auth',
        exact: true,
        component: Auth,
        auth: false,
    },
    {
        path: '/reports',
        exact: true,
        component: Reports,
        auth: true,
    },
    {
        path: '/report/:id',
        exact: true,
        component: Report,
        auth: true,
    }
]