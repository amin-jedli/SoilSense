// Import Firebase Authentication
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Firebase configuration (same as in app.js)
const firebaseConfig = {
  apiKey: "AIzaSyCQTCZgOWuxsZEJHa4jCRAtgP3qUGYTKPs",
  authDomain: "projet-pfe-7a49f.firebaseapp.com",
  databaseURL: "https://projet-pfe-7a49f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "projet-pfe-7a49f",
  storageBucket: "projet-pfe-7a49f.firebasestorage.app",
  messagingSenderId: "717832813364",
  appId: "1:717832813364:web:aff0724a50b60f24484361",
  measurementId: "G-DC1E8S1PQ5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');

// Handle login form submission
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Simple validation
  if (!email || !password) {
    errorMessage.textContent = 'Veuillez remplir tous les champs.';
    errorMessage.style.display = 'block';
    return;
  }

  // Sign in with Firebase Authentication
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed in successfully
      const user = userCredential.user;
      console.log('User logged in:', user);
      errorMessage.style.display = 'none';
      // Redirect to main page
      window.location.href = 'index.html';
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessageText = error.message;
      console.error('Login error:', errorCode, errorMessageText);
      errorMessage.textContent = 'Erreur de connexion : Vérifiez votre email ou mot de passe.';
      errorMessage.style.display = 'block';
    });
});