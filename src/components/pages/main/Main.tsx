import { Link } from 'react-router-dom';
import { Button, Grid } from '@mui/material';
import { useAuth } from '../../providers/useAuth';
import { signOut } from 'firebase/auth';

const Main = () => {
    const { user, ga } = useAuth() 
    return (
        <>
            <Grid display='flex' justifyContent='center' alignItems='center'>
                <Link to="/reports">
                    <button style={{ margin: '10px', padding: '10px 20px' }}>Отчеты</button>
                </Link>    
                <Link to="/button1">
                    <button style={{ margin: '10px', padding: '10px 20px' }}>Кнопка</button>
                </Link>
                <Link to="/button2">
                    <button style={{ margin: '10px', padding: '10px 20px' }}>Кнопка</button>
                </Link>
                <Button variant='outlined' onClick={() => signOut(ga)}>
                        Exit
                </Button>
            </Grid>
        </>
    );
};

export default Main