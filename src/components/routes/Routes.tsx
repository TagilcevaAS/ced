import React, { FC, useState } from 'react';
import { routes } from './dataRoutes';
import Layout from '../layout/Layout';
import { BrowserRouter as Router, Routes as ReactRoutes, Route } from 'react-router-dom';
import { useAuth } from '../providers/useAuth';
import Auth from '../pages/auth/Auth';

const Routes: FC = () => {
    const { user } = useAuth();
    const [categoryFilter, setCategoryFilter] = useState('');
    
    return (
        <Router>
            <ReactRoutes>
                {routes.map(route => (
                    <Route
                        path={route.path}
                        key={route.path}
                        element={
                            <Layout>
                                {route.auth && !user ? <Auth /> : <route.component categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />}
                            </Layout>
                        }
                    />
                ))}
            </ReactRoutes>
        </Router>
    );
}

export default Routes;
