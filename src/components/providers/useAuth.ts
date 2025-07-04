import { useContext } from "react"
import { AuthContext } from "./AuthProveder"

export const useAuth = () => {    
    const value = useContext(AuthContext)
    return value
}