import { Box } from "@mui/material"
import { FC, ReactNode } from "react";

interface CardProps {
    children: ReactNode;
}

const Card: FC<CardProps> = ({ children }) => {
    return (
        <Box
            sx={{
                border: '1px solid #F5DEB3',
                borderRadius: '10px',
                padding: 2,
                marginTop: 4,
            }}
        >
            {children}
        </Box>
    )
}

export default Card