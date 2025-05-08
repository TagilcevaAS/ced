import React from 'react';
import ReactDOM from 'react-dom';
import Routes from './components/routes/Routes';
import './index.css';
import * as firebase from 'firebase/app'
import { AuthProvider } from './components/providers/AuthProveder';

firebase.initializeApp({
  apiKey: "AIzaSyA3IWvyuF6obrwbm9J4NiPN7JJWj5elPrw",
  authDomain: "project-578482658934874066.firebaseapp.com",
  projectId: "project-578482658934874066",
  storageBucket: "project-578482658934874066.firebasestorage.app",
  messagingSenderId: "641666122192",
  appId: "1:641666122192:web:77df0695c74b42c92a39d5"
})

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <Routes />
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root')
)