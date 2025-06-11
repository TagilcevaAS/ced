import React from 'react';
import ReactDOM from 'react-dom';
import Routes from './components/routes/Routes';
import './index.css';
import * as firebase from 'firebase/app'
import { AuthProvider } from './components/providers/AuthProveder';

firebase.initializeApp({
  apiKey: "AIzaSyDOzNq15zTwdI20CBQxp3SZ0Xqs-hqAKPI",
  authDomain: "ced-39e61.firebaseapp.com",
  projectId: "ced-39e61",
  storageBucket: "ced-39e61.firebasestorage.app",
  messagingSenderId: "792145140807",
  appId: "1:792145140807:web:f9cb0dcbe2e31088e72562"
})

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <Routes />
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root')
)