import React, { FC, SyntheticEvent, useEffect, useState } from 'react';
import { Alert, Button, Grid, TextField } from '@mui/material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../../providers/useAuth';
import { useNavigate } from 'react-router-dom';
import { IUserData } from '../../../types';

const Auth: FC = () => {
    const { ga, user } = useAuth();
    const [userData, setUserData] = useState<IUserData>({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');

    const handleLogin = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(ga, userData.email, userData.password);
        } catch (error: any) {
            error.message && setError(error.message);
        }
        setUserData({ email: '', password: '' });
    };

    const navigate = useNavigate();
    useEffect(() => { if (user) navigate('/'); }, [user]);

    return (
        <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '100vh' }}>
            <Grid item xs={10} sm={6} md={4}>
                {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
                <form onSubmit={handleLogin}>
                    <TextField
                        type='email'
                        label='Email'
                        value={userData.email}
                        onChange={e => setUserData({...userData, email: e.target.value})}
                        fullWidth
                        margin='normal'
                        required
                    />
                    <TextField
                        type='password'
                        label='Password'
                        value={userData.password}
                        onChange={e => setUserData({...userData, password: e.target.value})}
                        fullWidth
                        margin='normal'
                        required
                    />
                    <Button 
                        type='submit' 
                        variant='contained' 
                        fullWidth
                        sx={{ mt: 2 }}
                    >
                        Войти
                    </Button>
                </form>
            </Grid>
        </Grid>
    );
};

export default Auth;