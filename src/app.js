import 'tailwindcss/tailwind.css';
import './styles.css';

import { ContactsManager } from './modules/contacts.js';
import { MessagesManager } from './modules/messages.js';
import { showNotification, setupGlobalErrorHandling, showConfirmPopup, showError } from './modules/errors.js';
import { resizeImage, validatePhone, formatPhone } from './modules/utils.js';

// Variables globales
let currentUser = null;
let isLoggedIn = false;

// Instances des managers
const contactsManager = new ContactsManager();
const messagesManager = new MessagesManager();

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
    // Configuration des erreurs globales
    setupGlobalErrorHandling();
    
    // Vérifier l'authentification
    checkAuthStatus();
    
    // Initialiser les événements d'authentification
    setupAuthEventListeners();
    
    // Si connecté, initialiser l'application
    if (isLoggedIn) {
        await initializeApp();
    }
});

// Vérifier le statut d'authentification
function checkAuthStatus() {
    const token = localStorage.getItem('whatsapp_token');
    const userData = localStorage.getItem('whatsapp_user');
    
    if (token && userData) {
        try {
            currentUser = JSON.parse(userData);
            isLoggedIn = true;
            showApp();
        } catch (error) {
            console.error('Erreur lors de la récupération des données utilisateur:', error);
            clearAuthData();
            showLogin();
        }
    } else {
        showLogin();
    }
}

// Afficher la vue de connexion
function showLogin() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

// Afficher l'application
function showApp() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

// Initialiser l'application
async function initializeApp() {
    updateUserInterface();
    setupAppEventListeners();
    await loadAppData();
    showNotification('Application chargée avec succès', 'success');
}

// Configuration des événements d'authentification
function setupAuthEventListeners() {
    // Formulaire de connexion
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Formulaire d'inscription
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Toggle mot de passe
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => togglePasswordVisibility('password'));
    }
    
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    if (toggleNewPassword) {
        toggleNewPassword.addEventListener('click', () => togglePasswordVisibility('newPassword'));
    }
    
    // Liens de navigation
    const createAccountLink = document.getElementById('createAccountLink');
    if (createAccountLink) {
        createAccountLink.addEventListener('click', showRegisterView);
    }
    
    const backToLoginLink = document.getElementById('backToLoginLink');
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', showLoginView);
    }
    
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', handleForgotPassword);
    }
}

// Configuration des événements de l'application
function setupAppEventListeners() {
    // Navigation
    setupNavigationEvents();
    
    // Formulaires
    setupFormEvents();
    
    // Messages
    setupMessageEvents();
    
    // Recherche
    setupSearchEvents();
    
    // Menu contextuel
    setupMenuEvents();
    
    // Événements personnalisés
    document.addEventListener('startChat', async (e) => {
        const { name, phone, contactId } = e.detail;
        const chat = await messagesManager.createChat(name, phone, contactId);
        messagesManager.openChat(chat);
        showConversationsView();
    });
}

function setupNavigationEvents() {
    document.getElementById('new-chat-btn')?.addEventListener('click', showNewChatView);
    document.getElementById('back-to-chats')?.addEventListener('click', showConversationsView);
    document.getElementById('new-contact-btn')?.addEventListener('click', showAddContactView);
    document.getElementById('back-to-new-chat')?.addEventListener('click', showNewChatView);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
}

function setupFormEvents() {
    const addContactForm = document.getElementById('addContactForm');
    if (addContactForm) {
        addContactForm.addEventListener('submit', handleAddContact);
    }
    
    const contactAvatar = document.getElementById('contactAvatar');
    if (contactAvatar) {
        contactAvatar.addEventListener('change', handleAvatarUpload);
    }
}

function setupMessageEvents() {
    const messageInput = document.querySelector('#app-container footer input[type="text"]');
    const sendButton = document.querySelector('#app-container footer button:last-child');
    
    if (messageInput && sendButton) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput.addEventListener('input', function() {
            const icon = sendButton.querySelector('i');
            if (this.value.trim()) {
                icon.classList.remove('fa-microphone');
                icon.classList.add('fa-paper-plane');
            } else {
                icon.classList.remove('fa-paper-plane');
                icon.classList.add('fa-microphone');
            }
        });
        
        sendButton.addEventListener('click', () => {
            const icon = sendButton.querySelector('i');
            if (icon && icon.classList.contains('fa-paper-plane')) {
                sendMessage();
            }
        });
        
        messageInput.addEventListener('blur', function() {
            if (messagesManager.currentChat) {
                messagesManager.saveDraft(messagesManager.currentChat.id, this.value);
            }
        });
    }
}

function setupSearchEvents() {
    const contactSearch = document.getElementById('contact-search');
    if (contactSearch) {
        contactSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            contactsManager.filterContacts(searchTerm);
        });
    }
}

function setupMenuEvents() {
    const menuBtn = document.getElementById('chat-menu-btn');
    const menuDropdown = document.getElementById('chat-menu-dropdown');
    const deleteBtn = document.getElementById('delete-contact-btn');
    
    if (menuBtn && menuDropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('hidden');
        });
        
        document.addEventListener('click', () => {
            menuDropdown.classList.add('hidden');
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!messagesManager.currentChat) return;
            
            showConfirmPopup(`Supprimer le contact "${messagesManager.currentChat.name}" ?`, async () => {
                await contactsManager.deleteContact(messagesManager.currentChat.contactId);
                await messagesManager.deleteChat(messagesManager.currentChat.id);
                messagesManager.currentChat = null;
            });
            
            menuDropdown.classList.add('hidden');
        });
    }
    
    const contactsMenuBtn = document.getElementById('contacts-menu-btn');
    const contactsMenuDropdown = document.getElementById('contacts-menu-dropdown');

    if (contactsMenuBtn && contactsMenuDropdown) {
        contactsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            contactsMenuDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => {
            contactsMenuDropdown.classList.add('hidden');
        });
        contactsMenuDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Afficher la page profil quand on clique sur l'avatar en bas de la sidebar
    document.querySelectorAll('.sidebar-avatar, .sidebar-avatar img').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('profile-view').classList.remove('hidden');
            if (currentUser) {
                document.getElementById('profile-avatar').src = currentUser.avatar || 'images/xxx.jpeg';
                document.getElementById('profile-name').textContent = currentUser.name || 'Fatousha';
                document.getElementById('profile-phone').textContent = currentUser.phone || '+221 77 142 81 50';
                document.getElementById('profile-status').textContent = currentUser.status || 'Utilisateur privé';
                document.getElementById('profile-location').textContent = currentUser.location || 'Dakar, Sénégal';
            }
        });
    });

    // Bouton retour
    document.getElementById('back-to-main-btn')?.addEventListener('click', () => {
        document.getElementById('profile-view').classList.add('hidden');
    });

    // Paramètres
    document.querySelector('aside .fa-gear')?.parentElement?.addEventListener('click', () => {
        document.getElementById('settings-view').classList.remove('hidden');
        if (currentUser) {
            document.getElementById('settings-username').textContent = currentUser.name || '';
            document.querySelector('#settings-view img[alt="User"]').src = currentUser.avatar || 'images/xxx.jpeg';
        }
    });
    
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
        document.getElementById('settings-view').classList.add('hidden');
    });

    // Nouveau groupe
    document.querySelectorAll('#contacts-menu-dropdown button').forEach(btn => {
        if (btn.textContent.includes('Nouveau groupe')) {
            btn.addEventListener('click', () => {
                document.getElementById('add-group-view').classList.remove('hidden');
                document.getElementById('contacts-menu-dropdown').classList.add('hidden');
                renderGroupContactList();
            });
        }
    });

    document.getElementById('back-to-main-from-group')?.addEventListener('click', () => {
        document.getElementById('add-group-view').classList.add('hidden');
    });
}

// Gérer la connexion
async function handleLogin(event) {
    event.preventDefault();
    
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginSpinner = document.getElementById('loginSpinner');
    
    const formData = new FormData(event.target);
    const identifier = formData.get('identifier').trim();
    const password = formData.get('password');
    const rememberMe = formData.get('rememberMe') === 'on';
    
    if (!identifier || !password) {
        showError('loginError', 'Veuillez remplir tous les champs');
        return;
    }
    
    setLoadingState(loginBtn, loginBtnText, loginSpinner, true);
    hideError('loginError');
    
    try {
        const users = await loadUsersData();
        
        const user = users.find(u => 
            (u.email === identifier || u.phone === identifier) && u.password === password
        );
        
        if (!user) {
            throw new Error('Identifiants incorrects');
        }
        
        const token = generateToken();
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar || null
        };
        
        localStorage.setItem('whatsapp_token', token);
        localStorage.setItem('whatsapp_user', JSON.stringify(userData));
        
        if (rememberMe) {
            localStorage.setItem('whatsapp_remember', 'true');
        }
        
        currentUser = userData;
        isLoggedIn = true;
        
        showApp();
        await initializeApp();
        
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showError('loginError', error.message || 'Erreur de connexion');
    } finally {
        setLoadingState(loginBtn, loginBtnText, loginSpinner, false);
    }
}

// Gérer l'inscription
async function handleRegister(event) {
    event.preventDefault();
    
    const registerBtn = document.getElementById('registerBtn');
    const registerBtnText = document.getElementById('registerBtnText');
    const registerSpinner = document.getElementById('registerSpinner');
    
    const formData = new FormData(event.target);
    const fullName = formData.get('fullName').trim();
    const email = formData.get('email').trim();
    const phone = formData.get('phone').trim();
    const password = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');
    
    if (!fullName || !email || !phone || !password || !confirmPassword) {
        showError('registerError', 'Veuillez remplir tous les champs');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('registerError', 'Les mots de passe ne correspondent pas');
        return;
    }
    
    if (password.length < 6) {
        showError('registerError', 'Le mot de passe doit contenir au moins 6 caractères');
        return;
    }
    
    if (!isValidEmail(email)) {
        showError('registerError', 'Adresse email invalide');
        return;
    }
    
    if (!isValidPhone(phone)) {
        showError('registerError', 'Numéro de téléphone invalide');
        return;
    }
    
    setLoadingState(registerBtn, registerBtnText, registerSpinner, true);
    hideError('registerError');
    
    try {
        const users = await loadUsersData();
        
        const existingUser = users.find(u => u.email === email || u.phone === phone);
        if (existingUser) {
            throw new Error('Un compte existe déjà avec cet email ou ce numéro');
        }
        
        const newUser = {
            id: generateUserId(),
            name: fullName,
            email: email,
            phone: phone,
            password: password,
            avatar: null,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        users.push(newUser);
        localStorage.setItem('whatsapp_users', JSON.stringify(users));
        
        const token = generateToken();
        const userData = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            avatar: newUser.avatar
        };
        
        localStorage.setItem('whatsapp_token', token);
        localStorage.setItem('whatsapp_user', JSON.stringify(userData));
        
        currentUser = userData;
        isLoggedIn = true;
        
        showApp();
        await initializeApp();
        
    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        showError('registerError', error.message || 'Erreur lors de la création du compte');
    } finally {
        setLoadingState(registerBtn, registerBtnText, registerSpinner, false);
    }
}

// Charger les données utilisateurs
async function loadUsersData() {
    try {
        const response = await fetch('src/data.json');
        if (response.ok) {
            const data = await response.json();
            if (data.users && Array.isArray(data.users)) {
                return data.users;
            }
        }
    } catch (error) {
        console.log('Impossible de charger data.json, utilisation du localStorage');
    }
    
    const savedUsers = localStorage.getItem('whatsapp_users');
    if (savedUsers) {
        return JSON.parse(savedUsers);
    }
    
    return [
        {
            id: 1,
            name: "Admin",
            email: "admin@whatsapp.com",
            phone: "+221771234567",
            password: "admin123",
            avatar: null,
            createdAt: new Date().toISOString(),
            isActive: true
        }
    ];
}

// Gestionnaires d'événements de l'application
async function handleAddContact(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveContactBtn');
    const formData = new FormData(event.target);
    
    const contactData = {
        prenom: formData.get('prenom').trim(),
        prenomPhonetique: formData.get('prenom-phonetique').trim(),
        nom: formData.get('nom').trim(),
        nomPhonetique: formData.get('nom-phonetique').trim(),
        entreprise: formData.get('entreprise').trim(),
        phone: formData.get('phone').trim()
    };
    
    const avatarImg = document.querySelector('#add-contact-view img[alt="Avatar"]');
    if (avatarImg && avatarImg.src.startsWith('data:')) {
        contactData.avatar = avatarImg.src;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement...';
    
    try {
        await contactsManager.addContact(contactData);
        event.target.reset();
        resetAvatarDisplay();
        showNewChatView();
    } catch (error) {
        showError('addContactError', error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer';
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('L\'image ne doit pas dépasser 10MB', 'error');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        showNotification('Veuillez sélectionner une image valide', 'error');
        return;
    }
    
    try {
        const resizedImage = await resizeImage(file, 200, 200, 0.8);
        const avatarContainer = document.querySelector('#add-contact-view .w-32.h-32');
        if (avatarContainer) {
            avatarContainer.innerHTML = `
                <img src="${resizedImage}" alt="Avatar" class="w-full h-full object-cover rounded-full">
            `;
        }
        showNotification('Image chargée avec succès', 'success');
    } catch (error) {
        showNotification('Erreur lors du traitement de l\'image', 'error');
    }
}

async function sendMessage() {
    const messageInput = document.querySelector('#app-container footer input[type="text"]');
    if (!messageInput) return;
    
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    
    await messagesManager.sendMessage(messageText);
    messageInput.value = '';
    
    const sendButton = document.querySelector('#app-container footer button:last-child i');
    if (sendButton) {
        sendButton.classList.remove('fa-paper-plane');
        sendButton.classList.add('fa-microphone');
    }
}

// Navigation
function showConversationsView() {
    document.getElementById('conversations-view').classList.remove('hidden');
    document.getElementById('new-chat-view').classList.add('hidden');
    document.getElementById('add-contact-view').classList.add('hidden');
}

function showNewChatView() {
    document.getElementById('conversations-view').classList.add('hidden');
    document.getElementById('new-chat-view').classList.remove('hidden');
    document.getElementById('add-contact-view').classList.add('hidden');
    contactsManager.renderContactList();
}

function showAddContactView() {
    document.getElementById('conversations-view').classList.add('hidden');
    document.getElementById('new-chat-view').classList.add('hidden');
    document.getElementById('add-contact-view').classList.remove('hidden');
    
    const form = document.getElementById('addContactForm');
    if (form) {
        form.reset();
        resetAvatarDisplay();
    }
}

function showLoginView() {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('register-view').classList.add('hidden');
}

function showRegisterView() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('register-view').classList.remove('hidden');
}

// Utilitaires
function resetAvatarDisplay() {
    const avatarContainer = document.querySelector('#add-contact-view .w-32.h-32');
    if (avatarContainer) {
        avatarContainer.innerHTML = `<i class="fa-solid fa-image text-4xl text-blue-400"></i>`;
    }
}

function updateUserInterface() {
    if (currentUser) {
        const userAvatar = document.querySelector('aside img[alt="Avatar"]');
        if (userAvatar && currentUser.avatar) {
            userAvatar.src = currentUser.avatar;
        }
    }
}

function handleLogout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        clearAuthData();
        showLogin();
    }
}

function clearAuthData() {
    localStorage.removeItem('whatsapp_token');
    localStorage.removeItem('whatsapp_user');
    localStorage.removeItem('whatsapp_remember');
    currentUser = null;
    isLoggedIn = false;
}

async function loadAppData() {
    try {
        await Promise.all([
            contactsManager.loadContacts(),
            messagesManager.loadChats()
        ]);
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        showNotification('Erreur lors du chargement des données', 'error');
    }
}

function renderGroupContactList() {
    const groupContacts = [
        {
            avatar: "images/avatar1.png",
            name: "Ababacar Diop Kounoune Parcelle",
            status: "Salut ! J'utilise WhatsApp."
        },
        {
            avatar: "images/avatar2.png",
            name: "Abdou Ahade Ferdor",
            status: "Salut ! J'utilise WhatsApp."
        },
        {
            avatar: "images/avatar3.png",
            name: "Abdou Diallo",
            status: "Salut ! J'utilise WhatsApp."
        },
        {
            avatar: "images/avatar4.png",
            name: "Abdou Faye",
            status: "L'heure est venue de s'en aller, moi pour mourir d…"
        },
        {
            avatar: "images/avatar5.png",
            name: "Abdou Khadar M Baye",
            status: "Salut ! J'utilise WhatsApp."
        }
    ];

    const ul = document.getElementById('group-contacts-list');
    if (!ul) return;
    ul.innerHTML = '';
    groupContacts.forEach(contact => {
        ul.innerHTML += `
            <li class="flex items-center gap-4">
                <img src="${contact.avatar}" alt="Avatar" class="w-14 h-14 rounded-full bg-gray-200 object-cover">
                <div>
                    <div class="font-semibold text-base">${contact.name}</div>
                    <div class="text-gray-500 text-sm">${contact.status}</div>
                </div>
            </li>
        `;
    });
}

// Fonctions utilitaires d'authentification
function generateToken() {
    return 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function generateUserId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(`toggle${inputId.charAt(0).toUpperCase() + inputId.slice(1)}`);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
}

function setLoadingState(button, textElement, spinner, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('opacity-75', 'cursor-not-allowed');
        textElement.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        button.disabled = false;
        button.classList.remove('opacity-75', 'cursor-not-allowed');
        textElement.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

function handleForgotPassword() {
    alert('Fonctionnalité de récupération de mot de passe à implémenter');
}

// Exposer les variables globales
window.currentUser = currentUser;
window.isLoggedIn = isLoggedIn;