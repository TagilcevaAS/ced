import React, { FC, ReactNode } from 'react';
import { Grid } from '@mui/material';
import { useAuth } from '../providers/useAuth';

interface LayoutProps {
    children: ReactNode;
}

const Layout: FC<LayoutProps> = ({ children }) => {
    const { user } = useAuth()
    return (
        <>
            <Grid container spacing={2} marginTop={1}>
                {user && (
                    <Grid item md={1}></Grid>
                )}
                <Grid item md={user ? 10 : 12}>
                    {children}
                </Grid>
            </Grid>
        </>
    )
}

export default Layout