import { FC, createContext, useState, useEffect, useMemo } from "react";
import { IUser, IContext, AuthContextProps } from "../../types";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { doc, setDoc } from 'firebase/firestore';

export const AuthContext = createContext<IContext>({} as IContext)

export const AuthProvider: FC<AuthContextProps> = ({ children }) => { 
    const [user, setUser] = useState<IUser | null>(null)
    const ga = getAuth()
    const db = getFirestore()

    const updateUser = async (updatedUser: IUser) => {
        setUser(updatedUser);
        try {
            const userDocRef = doc(db, 'users', updatedUser._id);
            await setDoc(userDocRef, updatedUser);
        } catch (error) {
            console.error('Error updating user in Firestore:', error);
        }
    };

    useEffect(() => {
        const unListen = onAuthStateChanged(ga, authUser => {
            if (authUser)
                setUser(
                    {
                        _id: authUser.uid,
                        email: authUser.email || '',
                        name: authUser.displayName || '',
                    }
                )
            else setUser(null)
        })
        return () => {
            unListen()
        }
    }, [])

    const values = useMemo(() => ({
        user,
        setUser,
        ga,
        db,
        updateUser,
    }), [user])

    return (
        <AuthContext.Provider value={values}>
            {children}
        </AuthContext.Provider>
    )
}