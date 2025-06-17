import 'tailwindcss/tailwind.css';
import './styles.css';

import { ContactsManager } from './modules/contacts.js';
import { MessagesManager } from './modules/messages.js';
import { showNotification, setupGlobalErrorHandling, showConfirmPopup, showError } from './modules/errors.js';
import { resizeImage, validatePhone, formatPhone } from './modules/utils.js';

// Variables globales
let currentUser = window.currentUser || null;
let isLoggedIn = window.isLoggedIn || false;

// Instances des managers
const contactsManager = new ContactsManager();
const messagesManager = new MessagesManager();

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    if (!isLoggedIn || !currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Configuration des erreurs globales
    setupGlobalErrorHandling();
    
    // Initialiser l'interface
    updateUserInterface();
    setupEventListeners();
    
    // Charger les données
    await loadAppData();
    
    showNotification('Application chargée avec succès', 'success');
});

// Configuration des événements
function setupEventListeners() {
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
    const messageInput = document.querySelector('footer input[type="text"]');
    const sendButton = document.querySelector('footer button:last-child');
    
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
        
        // Sauvegarde le brouillon seulement quand on quitte le champ (blur)
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
     const mainMenuBtn = document.getElementById('main-menu-btn');
    const mainMenuDropdown = document.getElementById('main-menu-dropdown');

    if (mainMenuBtn && mainMenuDropdown) {
        mainMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mainMenuDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!mainMenuDropdown.contains(e.target) && !mainMenuBtn.contains(e.target)) {
                mainMenuDropdown.classList.add('hidden');
            }
        });

        mainMenuDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}


// Afficher la page profil quand on clique sur l'avatar en bas de la sidebar
document.querySelectorAll('.sidebar-avatar, .sidebar-avatar img').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById('profile-view').classList.remove('hidden');
    // Optionnel : mettre à jour les infos dynamiquement
    const user = window.currentUser;
    if (user) {
      document.getElementById('profile-avatar').src = user.avatar || 'images/xxx.jpeg';
      document.getElementById('profile-name').textContent = user.name || 'Fatousha';
      document.getElementById('profile-phone').textContent = user.phone || '+221 77 142 81 50';
      document.getElementById('profile-status').textContent = user.status || 'Utilisateur privé';
      document.getElementById('profile-location').textContent = user.location || 'Dakar, Sénégal';
    }
  });
});

// Bouton retour
document.getElementById('back-to-main-btn')?.addEventListener('click', () => {
  document.getElementById('profile-view').classList.add('hidden');
});

// Gestionnaires d'événements
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
    
    // Récupérer l'avatar
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
    const messageInput = document.querySelector('footer input[type="text"]');
    if (!messageInput) return;
    
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    
    await messagesManager.sendMessage(messageText);
    messageInput.value = '';
    
    // Remettre l'icône micro
    const sendButton = document.querySelector('footer button:last-child i');
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

// Utilitaires
function resetAvatarDisplay() {
    const avatarContainer = document.querySelector('#add-contact-view .w-32.h-32');
    if (avatarContainer) {
        avatarContainer.innerHTML = `<i class="fa-solid fa-image text-4xl text-blue-400"></i>`;
    }
}

function updateUserInterface() {
    if (currentUser) {
        const userAvatar = document.querySelector('aside img[alt="User"]');
        if (userAvatar && currentUser.avatar) {
            userAvatar.src = currentUser.avatar;
        }
    }
}

function handleLogout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        localStorage.removeItem('whatsapp_token');
        localStorage.removeItem('whatsapp_user');
        localStorage.removeItem('whatsapp_remember');
        window.location.href = 'login.html';
    }
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

document.querySelector('aside .fa-gear')?.parentElement?.addEventListener('click', () => {
    document.getElementById('settings-view').classList.remove('hidden');
    // Optionnel : mettre à jour le nom/avatar utilisateur
    const user = window.currentUser;
    if (user) {
        document.getElementById('settings-username').textContent = user.name || '';
        document.querySelector('#settings-view img[alt="User"]').src = user.avatar || 'images/xxx.jpeg';
    }
});
document.getElementById('close-settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-view').classList.add('hidden');
});

// Affiche la vue "Ajouter des membres au groupe"
document.querySelectorAll('#contacts-menu-dropdown button').forEach(btn => {
  if (btn.textContent.includes('Nouveau groupe')) {
    btn.addEventListener('click', () => {
      document.getElementById('add-group-view').classList.remove('hidden');
      document.getElementById('contacts-menu-dropdown').classList.add('hidden');
      renderGroupContactList(); // <-- Ajoute cet appel ici
    });
  }
});

// Bouton retour pour fermer la vue
document.getElementById('back-to-main-from-group')?.addEventListener('click', () => {
  document.getElementById('add-group-view').classList.add('hidden');
});

const groupContacts = [
  {
    avatar: "images/avatar1.png",
    name: "Ababacar Diop Kounoune Parcelle",
    status: "Salut ! J’utilise WhatsApp."
  },
  {
    avatar: "images/avatar2.png",
    name: "Abdou Ahade Ferdor",
    status: "Salut ! J’utilise WhatsApp."
  },
  {
    avatar: "images/avatar3.png",
    name: "Abdou Diallo",
    status: "Salut ! J’utilise WhatsApp."
  },
  {
    avatar: "images/avatar4.png",
    name: "Abdou Faye",
    status: "L'heure est venue de s'en aller, moi pour mourir d…"
  },
  {
    avatar: "images/avatar5.png",
    name: "Abdou Khadar M Baye",
    status: "Salut ! J’utilise WhatsApp."
  }
];

function renderGroupContactList() {
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