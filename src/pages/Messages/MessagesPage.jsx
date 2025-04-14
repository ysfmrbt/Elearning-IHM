import React, {
	useState,
	useEffect,
	useCallback,
	useMemo,
	useRef,
} from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getDatabase, ref, get, onValue } from 'firebase/database';
import { Link } from 'react-router-dom';
import {
	MdInbox,
	MdOutbox,
	MdRefresh,
	MdMarkEmailRead,
	MdMarkEmailUnread,
	MdDelete,
	MdSend,
	MdPerson,
	MdPeople,
	MdAdminPanelSettings,
	MdSchool,
	MdClose,
	MdSearch,
	MdLabel,
	MdStar,
	MdStarBorder,
	MdFilterList,
	MdArrowBack,
	MdMoreVert,
	MdArchive,
	MdReply,
	MdForward,
	MdMessage,
	MdEmail,
	MdRestore,
	MdSettings,
	MdHelp,
	MdAccessTime,
	MdNotifications,
	MdKeyboardTab,
	MdKeyboardArrowDown,
	MdKeyboardArrowUp,
	MdMenu,
} from 'react-icons/md';
import {
	getReceivedMessages,
	getSentMessages,
	markMessageAsRead,
	archiveMessage,
	getAvailableRecipients,
	sendMessage,
} from '../../utils/messageUtils';
import OptimizedLoadingSpinner from '../../components/Common/OptimizedLoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import ArchivedMessagesView from '../../components/Messages/ArchivedMessagesView';
import { useToast } from '../../components/Common/ToastProvider';
import useMediaQuery from '../../hooks/useMediaQuery';
import '../../styles/toggle.css';

const MessagesPage = () => {
	const { user, userRole, loading: authLoading } = useAuth();
	const toast = useToast();
	const isMobile = useMediaQuery('(max-width: 768px)');
	const messageListRef = useRef(null);
	const messageContentRef = useRef(null);

	// Message state
	const [messages, setMessages] = useState([]);
	const [sentMessages, setSentMessages] = useState([]);
	const [loadingMessages, setLoadingMessages] = useState(true);
	const [loadingStartTime, setLoadingStartTime] = useState(Date.now());
	const [error, setError] = useState('');
	const [activeTab, setActiveTab] = useState('inbox');
	const [selectedMessage, setSelectedMessage] = useState(null);
	const [showNewMessageModal, setShowNewMessageModal] = useState(false);
	const [showArchivedMessages, setShowArchivedMessages] = useState(false);
	const [recipients, setRecipients] = useState({
		admins: [],
		instructors: [],
		students: [],
	});
	const [selectedRecipientId, setSelectedRecipientId] = useState('');
	const [subject, setSubject] = useState('');
	const [messageContent, setMessageContent] = useState('');
	const [sending, setSending] = useState(false);
	const [success, setSuccess] = useState('');

	// Enhanced inbox features
	const [searchQuery, setSearchQuery] = useState('');
	const [activeCategory, setActiveCategory] = useState('all');
	const [showSidebar, setShowSidebar] = useState(!isMobile);
	const [isReplying, setIsReplying] = useState(false);
	const [replyContent, setReplyContent] = useState('');
	const [starredMessages, setStarredMessages] = useState([]);
	const [showSettings, setShowSettings] = useState(false);
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);
	const [refreshInterval, setRefreshInterval] = useState(60); // in seconds

	const database = getDatabase();

	// This section has been replaced with a more comprehensive implementation below

	const fetchMessages = useCallback(
		async (silent = false) => {
			// Store current user ID in a local variable to avoid closure issues
			const currentUserId = user?.uid;

			if (!currentUserId) {
				console.log('fetchMessages: Aucun utilisateur connecté');
				if (!silent) setLoadingMessages(false);
				return;
			}

			if (!silent) {
				setLoadingMessages(true);
				setLoadingStartTime(Date.now());
			}
			setError('');

			try {
				console.log(
					`fetchMessages: Récupération des messages pour ${currentUserId}`,
				);

				// Add a timeout to ensure we don't get stuck in loading state
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Timeout')), 10000),
				);

				const messagesPromise = Promise.all([
					getReceivedMessages(currentUserId),
					getSentMessages(currentUserId),
				]);

				// Race between the actual request and the timeout
				const [received, sent] = await Promise.race([
					messagesPromise,
					timeoutPromise.then(() => {
						console.warn('Message fetch timeout - using empty arrays');
						return [[], []];
					}),
				]);

				console.log(
					`fetchMessages: ${received.length} messages reçus, ${sent.length} messages envoyés`,
				);

				// Check for new messages without depending on the messages state
				let hasNewMessages = false;
				if (received && received.length > 0) {
					// Get current messages to compare
					const currentMessages = [];
					setMessages((prevMessages) => {
						currentMessages.push(...prevMessages);
						return received || [];
					});

					hasNewMessages = received.some(
						(msg) =>
							!currentMessages.some(
								(existingMsg) => existingMsg.id === msg.id,
							) && !msg.read,
					);
				} else {
					setMessages(received || []);
				}

				setSentMessages(sent || []);

				// Update starred messages
				const storedStarred = localStorage.getItem(
					`starredMessages_${currentUserId}`,
				);
				if (storedStarred) {
					try {
						setStarredMessages(JSON.parse(storedStarred));
					} catch (e) {
						console.error('Error parsing starred messages:', e);
						setStarredMessages([]);
					}
				}

				// Show notification if there are new messages
				if (hasNewMessages && !silent && notificationsEnabled) {
					// Use a function that doesn't depend on toast to avoid dependency issues
					const showToast = () => {
						if (toast && toast.info) {
							toast.info('Vous avez de nouveaux messages', { duration: 3000 });
						}
					};
					showToast();
				}
			} catch (err) {
				console.error('fetchMessages error:', err);
				if (!silent) {
					// Use a function that doesn't depend on toast to avoid dependency issues
					const showError = () => {
						if (toast && toast.error) {
							toast.error('Erreur lors de la récupération des messages');
						}
					};
					showError();
					setError('Erreur lors de la récupération des messages');
				}
				setMessages([]);
				setSentMessages([]);
			} finally {
				// Always set loading to false, even if there was an error
				if (!silent) {
					setLoadingMessages(false);
				}
			}
		},
		[user], // Only depend on user to minimize re-renders
	);

	// Initial fetch - only run once when component mounts
	useEffect(() => {
		// Set a timeout to ensure loading state doesn't get stuck
		const timeoutId = setTimeout(() => {
			if (loadingMessages) {
				console.warn('Loading timeout reached, forcing loading state to false');
				setLoadingMessages(false);
			}
		}, 15000); // 15 seconds timeout

		// Only fetch messages on initial mount
		fetchMessages();

		return () => clearTimeout(timeoutId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Empty dependency array to run only once

	// Set up automatic message loading with real-time updates
	const fetchMessagesRef = useRef(fetchMessages);

	// Update the ref when fetchMessages changes
	useEffect(() => {
		fetchMessagesRef.current = fetchMessages;
	}, [fetchMessages]);

	useEffect(() => {
		if (!user) return;

		console.log(`Setting up real-time message updates`);

		// Initial fetch
		fetchMessages();

		// Set up real-time listener for new messages
		const database = getDatabase();
		const inboxRef = ref(database, `elearning/messages/received/${user.uid}`);

		const unsubscribe = onValue(inboxRef, (snapshot) => {
			console.log('Real-time message update received');
			// Use the ref to avoid dependency on fetchMessages
			fetchMessagesRef.current(true); // silent refresh
		});

		// Set up periodic refresh as a fallback
		const intervalId =
			refreshInterval > 0
				? setInterval(() => {
						console.log('Running periodic silent refresh');
						fetchMessagesRef.current(true); // silent refresh
				  }, refreshInterval * 1000)
				: null;

		return () => {
			console.log('Clearing message listeners');
			unsubscribe();
			if (intervalId) clearInterval(intervalId);
		};
	}, [user, refreshInterval]); // Removed fetchMessages from dependencies

	useEffect(() => {
		if (!user || !userRole) {
			console.log('fetchRecipients: Utilisateur ou rôle manquant');
			return;
		}

		const fetchRecipients = async () => {
			try {
				console.log(
					`fetchRecipients: Récupération des destinataires pour ${user.uid} (${userRole})`,
				);
				const availableRecipients = await getAvailableRecipients(
					user.uid,
					userRole,
				);
				console.log(
					'fetchRecipients: Destinataires récupérés',
					availableRecipients,
				);
				setRecipients(
					availableRecipients || {
						admins: [],
						instructors: [],
						students: [],
					},
				);
			} catch (err) {
				console.error('fetchRecipients error:', err);
				setRecipients({
					admins: [],
					instructors: [],
					students: [],
				});
			}
		};

		fetchRecipients();
	}, [user, userRole]);

	// Toggle star status for a message
	const handleToggleStar = useCallback(
		(messageId, messageType) => {
			if (!user) return;

			// Update local state
			const isStarred = starredMessages.includes(messageId);
			let newStarredMessages;

			if (isStarred) {
				newStarredMessages = starredMessages.filter((id) => id !== messageId);
			} else {
				newStarredMessages = [...starredMessages, messageId];
			}

			// Save to localStorage
			localStorage.setItem(
				`starredMessages_${user.uid}`,
				JSON.stringify(newStarredMessages),
			);

			setStarredMessages(newStarredMessages);
			toast.info(
				isStarred ? 'Message retiré des favoris' : 'Message ajouté aux favoris',
				{ duration: 2000 },
			);
		},
		[user, starredMessages, toast],
	);

	const handleMarkAsRead = useCallback(
		async (messageId, isRead = true) => {
			if (!user) return;
			try {
				await markMessageAsRead(user.uid, messageId, isRead);

				setMessages((prev) =>
					prev.map((message) =>
						message.id === messageId ? { ...message, read: isRead } : message,
					),
				);

				if (selectedMessage && selectedMessage.id === messageId) {
					setSelectedMessage((prev) =>
						prev ? { ...prev, read: isRead } : null,
					);
				}

				// Show toast only when marking as unread (less intrusive)
				if (!isRead) {
					toast.info('Message marqué comme non lu', { duration: 2000 });
				}
			} catch (err) {
				toast.error('Erreur lors de la mise à jour du statut du message');
			}
		},
		[user, selectedMessage, toast],
	);

	const handleArchiveMessage = useCallback(
		async (messageId, messageType) => {
			if (!user) return;

			try {
				await archiveMessage(user.uid, messageId, messageType);

				if (messageType === 'received') {
					setMessages((prev) =>
						prev.filter((message) => message.id !== messageId),
					);
				} else {
					setSentMessages((prev) =>
						prev.filter((message) => message.id !== messageId),
					);
				}

				if (selectedMessage && selectedMessage.id === messageId) {
					setSelectedMessage(null);
				}
				toast.success('Message archivé avec succès');
			} catch (err) {
				toast.error("Erreur lors de l'archivage du message");
			}
		},
		[user, selectedMessage, toast],
	);

	const handleSendMessage = async (e) => {
		e.preventDefault();
		if (!user) {
			toast.error('Authentification requise.');
			return;
		}

		if (!selectedRecipientId) {
			toast.error('Veuillez sélectionner un destinataire');
			return;
		}

		const allRecipients = [
			...(recipients.admins || []),
			...(recipients.instructors || []),
			...(recipients.students || []),
		];
		const recipient = allRecipients.find((r) => r.id === selectedRecipientId);

		if (!recipient) {
			toast.error('Destinataire invalide.');
			return;
		}

		if (!subject.trim()) {
			toast.error('Veuillez saisir un sujet');
			return;
		}

		if (!messageContent.trim()) {
			toast.error('Veuillez saisir un message');
			return;
		}

		setSending(true);

		try {
			await sendMessage(
				user.uid,
				recipient.id,
				recipient.role,
				subject,
				messageContent,
			);

			setSelectedRecipientId('');
			setSubject('');
			setMessageContent('');
			setShowNewMessageModal(false);
			toast.success('Message envoyé avec succès');

			// Refresh sent messages
			const sent = await getSentMessages(user.uid);
			setSentMessages(sent);
		} catch (err) {
			toast.error(`Erreur lors de l'envoi du message: ${err.message}`);
		} finally {
			setSending(false);
		}
	};

	const openMessage = (message) => {
		setSelectedMessage(message);
		if (activeTab === 'inbox' && !message.read) {
			handleMarkAsRead(message.id, true);
		}
	};

	const closeMessage = () => {
		setSelectedMessage(null);
		setIsReplying(false);
		setReplyContent('');
	};

	const closeNewMessageModal = () => {
		setShowNewMessageModal(false);
		setSelectedRecipientId('');
		setSubject('');
		setMessageContent('');
		setError('');
	};

	const handleReply = async (e) => {
		e.preventDefault();
		if (!user || !selectedMessage || !replyContent.trim()) {
			if (!replyContent.trim()) {
				toast.error('Veuillez saisir une réponse');
			}
			return;
		}

		setSending(true);

		try {
			// Get recipient info from the selected message
			const recipientId =
				activeTab === 'inbox'
					? selectedMessage.senderId
					: selectedMessage.recipientId;
			const recipientRole =
				activeTab === 'inbox'
					? selectedMessage.senderType
					: selectedMessage.recipientType;
			const replySubject = `Re: ${selectedMessage.subject}`;

			await sendMessage(
				user.uid,
				recipientId,
				recipientRole,
				replySubject,
				replyContent,
			);

			// Refresh sent messages
			const sent = await getSentMessages(user.uid);
			setSentMessages(sent);

			// Reset reply state
			setIsReplying(false);
			setReplyContent('');
			toast.success('Réponse envoyée avec succès');
		} catch (err) {
			toast.error(`Erreur lors de l'envoi de la réponse: ${err.message}`);
		} finally {
			setSending(false);
		}
	};

	// Filter messages based on active category
	const filteredMessages = useMemo(() => {
		// If user is not logged in, return empty array
		if (!user) {
			return [];
		}

		// Calculate loading time only when needed, don't use Date.now() directly in the dependency array
		let shouldShowMessages = true;
		if (authLoading || loadingMessages) {
			const loadingTime = Date.now() - loadingStartTime;
			const loadingTooLong = loadingTime > 10000;
			shouldShowMessages = loadingTooLong;

			if (!shouldShowMessages) {
				return [];
			}
		}

		let result = [];

		if (activeTab === 'inbox') {
			result = messages.filter((msg) => {
				// Apply search filter
				const matchesSearch =
					!searchQuery ||
					msg.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					msg.senderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					msg.senderEmail?.toLowerCase().includes(searchQuery.toLowerCase());

				// Apply category filter
				if (activeCategory === 'unread') {
					return !msg.read && matchesSearch;
				} else if (activeCategory === 'starred') {
					return starredMessages.includes(msg.id) && matchesSearch;
				} else {
					return matchesSearch;
				}
			});
		} else if (activeTab === 'sent') {
			result = sentMessages.filter((msg) => {
				// Apply search filter
				return (
					!searchQuery ||
					msg.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					msg.recipientName
						?.toLowerCase()
						.includes(searchQuery.toLowerCase()) ||
					msg.recipientEmail?.toLowerCase().includes(searchQuery.toLowerCase())
				);
			});
		}

		return result;
	}, [
		user,
		authLoading,
		loadingMessages,
		loadingStartTime,
		activeTab,
		activeCategory,
		messages,
		sentMessages,
		searchQuery,
		starredMessages,
	]);

	const currentMessages = filteredMessages;

	// Rendering helper functions
	const renderName = (msg) => {
		if (activeTab === 'inbox') {
			return (
				msg.senderName || msg.sender?.firstName || msg.senderEmail || 'Inconnu'
			);
		}
		return (
			msg.recipientName ||
			msg.recipient?.firstName ||
			msg.recipientEmail ||
			'Inconnu'
		);
	};

	// Get message preview text
	const getMessagePreview = (msg) => {
		const content = msg.message || msg.content || '';
		return content.length > 100 ? content.substring(0, 100) + '...' : content;
	};

	const recipientOptions = [
		{ label: 'Administrateurs', options: recipients.admins || [] },
		{ label: 'Formateurs', options: recipients.instructors || [] },
		{ label: 'Étudiants', options: recipients.students || [] },
	];

	// Toggle settings panel
	const toggleSettings = () => {
		setShowSettings(!showSettings);
	};

	// Save settings
	const saveSettings = () => {
		// Save settings to localStorage
		localStorage.setItem(
			`messageSettings_${user.uid}`,
			JSON.stringify({
				notificationsEnabled,
				refreshInterval,
			}),
		);

		toast.success('Paramètres enregistrés');
		setShowSettings(false);
	};

	// Load settings from localStorage on component mount
	useEffect(() => {
		if (!user) return;

		const storedSettings = localStorage.getItem(`messageSettings_${user.uid}`);
		if (storedSettings) {
			const settings = JSON.parse(storedSettings);
			setNotificationsEnabled(settings.notificationsEnabled || false);
			setRefreshInterval(settings.refreshInterval || 60);
		}
	}, [user]);

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Only apply shortcuts when not in an input field
			if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
				return;

			// Ctrl+N: New message
			if (e.ctrlKey && e.key === 'n') {
				e.preventDefault();
				setShowNewMessageModal(true);
			}

			// Ctrl+R: Refresh messages
			if (e.ctrlKey && e.key === 'r') {
				e.preventDefault();
				fetchMessages();
			}

			// Esc: Close selected message or modal
			if (e.key === 'Escape') {
				if (selectedMessage) {
					closeMessage();
				} else if (showNewMessageModal) {
					closeNewMessageModal();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [selectedMessage, showNewMessageModal, fetchMessages]);

	// Conditional rendering for loading and unauthorized access
	// Calculate these values once per render to avoid inconsistencies
	const isLoading = authLoading || loadingMessages;
	const currentLoadingTime = Date.now() - loadingStartTime;
	const loadingTooLong = isLoading && currentLoadingTime > 15000;
	const showLoadingWarning = loadingTooLong;

	// Only show loading spinner if we're loading and haven't been loading too long
	if (isLoading && !loadingTooLong) {
		return <OptimizedLoadingSpinner />;
	}

	if (!user) {
		return (
			<div className='min-h-screen flex flex-col items-center justify-center'>
				<h1 className='text-2xl font-bold mb-4'>Accès non autorisé</h1>
				<p className='text-gray-600 mb-8'>
					Veuillez vous connecter pour accéder à la messagerie.
				</p>
				<Link
					to='/login'
					className='bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition-colors duration-300'>
					Connexion
				</Link>
			</div>
		);
	}

	return (
		<div className='container mx-auto px-4 py-6 h-[calc(100vh-100px)] flex flex-col'>
			{/* Loading warning message */}
			{showLoadingWarning && (
				<div className='bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4'>
					<div className='flex items-center'>
						<div className='flex-shrink-0'>
							<svg
								className='h-5 w-5 text-yellow-400'
								viewBox='0 0 20 20'
								fill='currentColor'>
								<path
									fillRule='evenodd'
									d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
									clipRule='evenodd'
								/>
							</svg>
						</div>
						<div className='ml-3'>
							<p className='text-sm text-yellow-700'>
								Le chargement des messages prend plus de temps que prévu.
								Certaines fonctionnalités peuvent être limitées.
								<button
									onClick={() => {
										setLoadingMessages(false);
										fetchMessages(true);
									}}
									className='ml-2 font-medium text-yellow-700 underline hover:text-yellow-600'>
									Réessayer
								</button>
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Keyboard shortcuts help tooltip */}
			<div className='fixed bottom-4 right-4 z-10'>
				<button
					onClick={() =>
						toast.info(
							'Raccourcis clavier: Ctrl+N (Nouveau message), Ctrl+R (Actualiser), Esc (Fermer)',
							{ duration: 5000 },
						)
					}
					className='bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-2 shadow-md'
					title='Aide raccourcis clavier'>
					<MdHelp size={20} />
				</button>
			</div>

			<div className='flex flex-col md:flex-row gap-4 flex-grow overflow-hidden'>
				{/* Mobile menu toggle */}
				{isMobile && (
					<div className='flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow-sm'>
						<button
							onClick={() => setShowSidebar(!showSidebar)}
							className='flex items-center gap-2 text-gray-700 hover:text-blue-600'>
							<MdMenu size={24} />
							<span className='font-medium'>Menu</span>
						</button>
						<div className='flex gap-2'>
							<button
								onClick={() => fetchMessages()}
								className='p-2 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-100'
								title='Actualiser'>
								<MdRefresh size={20} />
							</button>
							<button
								onClick={toggleSettings}
								className='p-2 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-100'
								title='Paramètres'>
								<MdSettings size={20} />
							</button>
						</div>
					</div>
				)}

				{/* Sidebar */}
				<aside
					className={`${
						showSidebar ? 'w-full md:w-1/4 lg:w-1/5' : 'hidden'
					} flex flex-col border rounded-lg shadow-sm bg-white overflow-hidden transition-all duration-300 ease-in-out`}>
					<div className='p-4 border-b bg-gray-50 flex justify-between items-center'>
						<button
							onClick={() => setShowNewMessageModal(true)}
							className='flex-grow bg-secondary text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300 flex items-center justify-center gap-2'>
							<MdSend /> Nouveau Message
						</button>
						{!isMobile && (
							<div className='flex ml-2'>
								<button
									onClick={() => fetchMessages()}
									className='p-2 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-100'
									title='Actualiser'>
									<MdRefresh size={20} />
								</button>
								<button
									onClick={toggleSettings}
									className='p-2 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-100'
									title='Paramètres'>
									<MdSettings size={20} />
								</button>
							</div>
						)}
					</div>

					{/* Search box */}
					<div className='p-3 border-b'>
						<div className='relative'>
							<input
								type='text'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder='Rechercher des messages...'
								className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary'
							/>
							<MdSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl' />
						</div>
					</div>

					{/* Settings panel */}
					{showSettings && (
						<div className='p-4 border-b bg-blue-50'>
							<h3 className='font-medium text-blue-800 mb-3 flex items-center gap-2'>
								<MdSettings /> Paramètres
							</h3>
							<div className='space-y-4'>
								<div className='flex items-center justify-between'>
									<label className='text-sm text-gray-700 flex items-center gap-2'>
										<MdNotifications /> Notifications
									</label>
									<div className='relative inline-block w-10 mr-2 align-middle select-none'>
										<input
											type='checkbox'
											checked={notificationsEnabled}
											onChange={() =>
												setNotificationsEnabled(!notificationsEnabled)
											}
											className='toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer'
										/>
										<label
											className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
												notificationsEnabled ? 'bg-blue-500' : 'bg-gray-300'
											}`}></label>
									</div>
								</div>

								<div>
									<label className='text-sm text-gray-700 flex items-center gap-2 mb-1'>
										<MdAccessTime /> Intervalle d'actualisation (secondes)
									</label>
									<input
										type='number'
										min='0'
										max='3600'
										value={refreshInterval}
										onChange={(e) =>
											setRefreshInterval(parseInt(e.target.value) || 0)
										}
										className='w-full p-2 border border-gray-300 rounded-lg'
									/>
								</div>

								<div className='flex justify-end gap-2 pt-2'>
									<button
										onClick={() => setShowSettings(false)}
										className='px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300'>
										Annuler
									</button>
									<button
										onClick={saveSettings}
										className='px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700'>
										Enregistrer
									</button>
								</div>
							</div>
						</div>
					)}

					{/* Message categories */}
					<div className='p-2 border-b'>
						<button
							onClick={() => {
								setActiveTab('inbox');
								setActiveCategory('all');
								setSelectedMessage(null);
							}}
							className={`w-full text-left p-2 rounded-lg flex items-center gap-2 ${
								activeTab === 'inbox' && activeCategory === 'all'
									? 'bg-blue-50 text-blue-700'
									: 'text-gray-700 hover:bg-gray-100'
							}`}>
							<MdInbox className='text-xl' /> Boîte de réception
							<span className='ml-auto bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full'>
								{messages.length}
							</span>
						</button>

						<button
							onClick={() => {
								setActiveTab('inbox');
								setActiveCategory('unread');
								setSelectedMessage(null);
							}}
							className={`w-full text-left p-2 rounded-lg flex items-center gap-2 ${
								activeTab === 'inbox' && activeCategory === 'unread'
									? 'bg-blue-50 text-blue-700'
									: 'text-gray-700 hover:bg-gray-100'
							}`}>
							<MdMarkEmailUnread className='text-xl' /> Non lus
							<span className='ml-auto bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full'>
								{messages.filter((m) => !m.read).length}
							</span>
						</button>

						<button
							onClick={() => {
								setActiveTab('inbox');
								setActiveCategory('starred');
								setSelectedMessage(null);
							}}
							className={`w-full text-left p-2 rounded-lg flex items-center gap-2 ${
								activeTab === 'inbox' && activeCategory === 'starred'
									? 'bg-blue-50 text-blue-700'
									: 'text-gray-700 hover:bg-gray-100'
							}`}>
							<MdStar className='text-xl text-yellow-500' /> Favoris
							<span className='ml-auto bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full'>
								{messages.filter((m) => starredMessages.includes(m.id)).length}
							</span>
						</button>

						<button
							onClick={() => {
								setActiveTab('sent');
								setActiveCategory('all');
								setSelectedMessage(null);
							}}
							className={`w-full text-left p-2 rounded-lg flex items-center gap-2 ${
								activeTab === 'sent'
									? 'bg-blue-50 text-blue-700'
									: 'text-gray-700 hover:bg-gray-100'
							}`}>
							<MdOutbox className='text-xl' /> Messages envoyés
							<span className='ml-auto bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full'>
								{sentMessages.length}
							</span>
						</button>

						<button
							onClick={() => setShowArchivedMessages(true)}
							className='w-full text-left p-2 rounded-lg flex items-center gap-2 text-gray-700 hover:bg-gray-100 mt-2'>
							<MdArchive className='text-xl' /> Messages archivés
						</button>
					</div>

					{/* Message list */}
					<div className='overflow-y-auto flex-grow'>
						{currentMessages.length === 0 ? (
							<div className='flex flex-col items-center justify-center h-40 p-4'>
								<div className='text-gray-400 mb-2'>
									{activeTab === 'inbox' ? (
										<MdInbox size={40} />
									) : (
										<MdOutbox size={40} />
									)}
								</div>
								<p className='text-gray-500 text-center'>
									{searchQuery
										? 'Aucun message ne correspond à votre recherche.'
										: activeTab === 'inbox'
										? 'Votre boîte de réception est vide.'
										: "Vous n'avez envoyé aucun message."}
								</p>
							</div>
						) : (
							currentMessages.map((msg) => (
								<div
									key={msg.id}
									onClick={() => openMessage(msg)}
									className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${
										selectedMessage?.id === msg.id ? 'bg-blue-50' : 'bg-white'
									}`}>
									<div className='flex items-start gap-3'>
										{/* Avatar or icon */}
										<div
											className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
												activeTab === 'inbox' && !msg.read
													? 'bg-blue-100 text-blue-600'
													: 'bg-gray-100 text-gray-600'
											}`}>
											{activeTab === 'inbox' ? (
												msg.senderType === 'admin' ? (
													<MdAdminPanelSettings size={20} />
												) : msg.senderType === 'instructor' ? (
													<MdSchool size={20} />
												) : (
													<MdPerson size={20} />
												)
											) : msg.recipientType === 'admin' ? (
												<MdAdminPanelSettings size={20} />
											) : msg.recipientType === 'instructor' ? (
												<MdSchool size={20} />
											) : (
												<MdPerson size={20} />
											)}
										</div>

										{/* Message content */}
										<div className='flex-grow min-w-0'>
											<div className='flex justify-between items-center mb-1'>
												<span
													className={`text-sm truncate max-w-[70%] ${
														activeTab === 'inbox' && !msg.read
															? 'font-semibold text-gray-900'
															: 'text-gray-700'
													}`}>
													{renderName(msg)}
												</span>
												<span className='text-xs text-gray-400 whitespace-nowrap'>
													{new Date(msg.timestamp).toLocaleDateString()}
												</span>
											</div>
											<h3
												className={`text-sm mb-1 truncate ${
													activeTab === 'inbox' && !msg.read
														? 'font-semibold text-gray-900'
														: 'font-medium text-gray-800'
												}`}>
												{msg.subject}
											</h3>
											<p className='text-xs text-gray-500 truncate'>
												{getMessagePreview(msg)}
											</p>
										</div>

										{/* Status indicators */}
										<div className='flex-shrink-0 flex flex-col items-center gap-2'>
											{activeTab === 'inbox' && !msg.read && (
												<span
													className='w-3 h-3 rounded-full bg-blue-600'
													title='Non lu'></span>
											)}
											<button
												onClick={(e) => {
													e.stopPropagation();
													handleToggleStar(
														msg.id,
														activeTab === 'inbox' ? 'received' : 'sent',
													);
												}}
												className='text-gray-400 hover:text-yellow-500 transition-colors duration-150'
												title={
													starredMessages.includes(msg.id)
														? 'Retirer des favoris'
														: 'Ajouter aux favoris'
												}>
												{starredMessages.includes(msg.id) ? (
													<MdStar
														className='text-yellow-500'
														size={18}
													/>
												) : (
													<MdStarBorder size={18} />
												)}
											</button>
										</div>
									</div>
								</div>
							))
						)}
					</div>

					{/* Footer with message count */}
					<div className='p-2 border-t bg-gray-50 flex justify-center text-xs text-gray-500'>
						{activeTab === 'inbox'
							? `${messages.length} message${
									messages.length !== 1 ? 's' : ''
							  } dans la boîte de réception`
							: `${sentMessages.length} message${
									sentMessages.length !== 1 ? 's' : ''
							  } envoyé${sentMessages.length !== 1 ? 's' : ''}`}
					</div>
				</aside>

				{/* Main content area */}
				<main className='w-full md:w-3/4 lg:w-4/5 flex flex-col border rounded-lg shadow-sm bg-white overflow-hidden'>
					{selectedMessage ? (
						<div className='flex flex-col h-full'>
							{/* Message header */}
							<div className='p-4 border-b flex justify-between items-center bg-gray-50'>
								<div className='flex items-center gap-3'>
									<button
										onClick={closeMessage}
										className='md:hidden text-gray-500 hover:text-gray-700 p-1 rounded-full'>
										<MdArrowBack size={24} />
									</button>
									<div>
										<h2 className='text-lg font-semibold truncate max-w-md'>
											{selectedMessage.subject}
										</h2>
										<div className='flex items-center gap-2 text-sm text-gray-600'>
											<span>
												{activeTab === 'inbox' ? 'De' : 'À'}:{' '}
												<span className='font-medium'>
													{renderName(selectedMessage)}
												</span>
											</span>
											{activeTab === 'inbox' && selectedMessage.read && (
												<span className='text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full'>
													Lu
												</span>
											)}
										</div>
										<p className='text-xs text-gray-500'>
											{new Date(selectedMessage.timestamp).toLocaleString()}
										</p>
									</div>
								</div>

								{/* Action buttons */}
								<div className='flex items-center gap-1'>
									{/* Star button */}
									<button
										onClick={() =>
											handleToggleStar(
												selectedMessage.id,
												activeTab === 'inbox' ? 'received' : 'sent',
											)
										}
										title={
											starredMessages.includes(selectedMessage.id)
												? 'Retirer des favoris'
												: 'Ajouter aux favoris'
										}
										className='text-gray-500 hover:text-yellow-500 p-2 rounded-full transition-colors duration-200'>
										{starredMessages.includes(selectedMessage.id) ? (
											<MdStar
												className='text-yellow-500'
												size={20}
											/>
										) : (
											<MdStarBorder size={20} />
										)}
									</button>

									{activeTab === 'inbox' && (
										<button
											onClick={() => setIsReplying(true)}
											title='Répondre'
											className='text-gray-500 hover:text-secondary p-2 rounded-full transition-colors duration-200'>
											<MdReply size={20} />
										</button>
									)}

									{activeTab === 'inbox' && (
										<button
											onClick={() =>
												handleMarkAsRead(
													selectedMessage.id,
													!selectedMessage.read,
												)
											}
											title={
												selectedMessage.read
													? 'Marquer comme non lu'
													: 'Marquer comme lu'
											}
											className='text-gray-500 hover:text-secondary p-2 rounded-full transition-colors duration-200'>
											{selectedMessage.read ? (
												<MdMarkEmailUnread size={20} />
											) : (
												<MdMarkEmailRead size={20} />
											)}
										</button>
									)}

									<button
										onClick={() =>
											handleArchiveMessage(selectedMessage.id, activeTab)
										}
										title='Archiver le message'
										className='text-gray-500 hover:text-blue-600 p-2 rounded-full transition-colors duration-200'>
										<MdArchive size={20} />
									</button>

									<button
										onClick={closeMessage}
										title='Fermer'
										className='hidden md:block text-gray-500 hover:text-gray-800 p-2 rounded-full transition-colors duration-200'>
										<MdClose size={20} />
									</button>
								</div>
							</div>

							{/* Message content */}
							<div className='p-6 overflow-y-auto flex-grow'>
								<div className='max-w-3xl mx-auto'>
									{/* Sender info card */}
									<div className='flex items-center gap-4 mb-6'>
										<div
											className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
												activeTab === 'inbox'
													? 'bg-blue-100 text-blue-600'
													: 'bg-gray-100 text-gray-600'
											}`}>
											{activeTab === 'inbox' ? (
												selectedMessage.senderType === 'admin' ? (
													<MdAdminPanelSettings size={24} />
												) : selectedMessage.senderType === 'instructor' ? (
													<MdSchool size={24} />
												) : (
													<MdPerson size={24} />
												)
											) : selectedMessage.recipientType === 'admin' ? (
												<MdAdminPanelSettings size={24} />
											) : selectedMessage.recipientType === 'instructor' ? (
												<MdSchool size={24} />
											) : (
												<MdPerson size={24} />
											)}
										</div>
										<div>
											<h3 className='font-medium'>
												{renderName(selectedMessage)}
											</h3>
											<p className='text-sm text-gray-500'>
												{activeTab === 'inbox'
													? selectedMessage.senderEmail
													: selectedMessage.recipientEmail || ''}
											</p>
										</div>
									</div>

									{/* Message body */}
									<div className='prose max-w-none whitespace-pre-wrap text-gray-800 mb-8'>
										{selectedMessage.message || selectedMessage.content}
									</div>

									{/* Reply form */}
									{isReplying && activeTab === 'inbox' && (
										<div className='mt-6 border-t pt-6'>
											<h3 className='font-medium mb-3 flex items-center gap-2'>
												<MdReply /> Répondre à {renderName(selectedMessage)}
											</h3>
											<form onSubmit={handleReply}>
												<textarea
													value={replyContent}
													onChange={(e) => setReplyContent(e.target.value)}
													placeholder='Votre réponse...'
													rows={6}
													className='w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary'
													required></textarea>
												<div className='flex justify-end gap-3 mt-3'>
													<button
														type='button'
														onClick={() => {
															setIsReplying(false);
															setReplyContent('');
														}}
														className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200'>
														Annuler
													</button>
													<button
														type='submit'
														disabled={sending || !replyContent.trim()}
														className='px-4 py-2 bg-secondary text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'>
														{sending ? 'Envoi en cours...' : 'Envoyer'}
														{!sending && <MdSend />}
													</button>
												</div>
											</form>
										</div>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className='flex flex-col items-center justify-center h-full p-8 text-gray-500'>
							<div className='text-gray-300 mb-4'>
								<MdEmail size={64} />
							</div>
							<h3 className='text-xl font-medium mb-2'>
								Aucun message sélectionné
							</h3>
							<p className='text-center max-w-md'>
								Sélectionnez un message dans la liste pour le lire ou cliquez
								sur "Nouveau Message" pour en rédiger un.
							</p>
						</div>
					)}
				</main>

				{/* New Message Modal */}
				<AnimatePresence>
					{showNewMessageModal && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
							onClick={closeNewMessageModal}>
							<motion.div
								initial={{ scale: 0.9, y: 20 }}
								animate={{ scale: 1, y: 0 }}
								exit={{ scale: 0.9, y: 20 }}
								className='bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden'
								onClick={(e) => e.stopPropagation()}>
								<form onSubmit={handleSendMessage}>
									<div className='p-6 border-b flex justify-between items-center bg-gray-50'>
										<h2 className='text-xl font-semibold flex items-center gap-2'>
											<MdSend className='text-secondary' /> Nouveau Message
										</h2>
										<button
											type='button'
											onClick={closeNewMessageModal}
											className='text-gray-400 hover:text-gray-600 p-1 rounded-full'>
											<MdClose size={24} />
										</button>
									</div>
									<div className='p-6 space-y-4'>
										{error && (
											<div className='bg-red-100 border border-red-400 text-red-700 p-3 rounded-lg text-sm flex items-start'>
												<MdClose className='text-red-500 mr-2 mt-0.5 flex-shrink-0' />
												<span>{error}</span>
											</div>
										)}

										{/* Recipient selection */}
										<div>
											<label
												htmlFor='recipient'
												className='flex items-center gap-1 text-sm font-medium text-gray-700 mb-1'>
												<MdPerson className='text-secondary' /> Destinataire
											</label>
											<select
												id='recipient'
												value={selectedRecipientId}
												onChange={(e) => setSelectedRecipientId(e.target.value)}
												required
												className='w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-secondary bg-white'>
												<option value=''>
													-- Sélectionnez un destinataire --
												</option>
												{recipientOptions.map(
													(group, index) =>
														group.options.length > 0 && (
															<optgroup
																key={index}
																label={group.label}>
																{group.options.map((recipient) => (
																	<option
																		key={recipient.id}
																		value={recipient.id}>
																		{recipient.firstName || ''}{' '}
																		{recipient.lastName || ''} (
																		{recipient.email})
																	</option>
																))}
															</optgroup>
														),
												)}
											</select>
										</div>

										{/* Subject field */}
										<div>
											<label
												htmlFor='subject'
												className='flex items-center gap-1 text-sm font-medium text-gray-700 mb-1'>
												<MdLabel className='text-secondary' /> Sujet
											</label>
											<input
												type='text'
												id='subject'
												value={subject}
												onChange={(e) => setSubject(e.target.value)}
												placeholder='Saisissez le sujet de votre message'
												required
												className='w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-secondary'
											/>
										</div>

										{/* Message content */}
										<div>
											<label
												htmlFor='messageContent'
												className='flex items-center gap-1 text-sm font-medium text-gray-700 mb-1'>
												<MdMessage className='text-secondary' /> Message
											</label>
											<textarea
												id='messageContent'
												rows={8}
												value={messageContent}
												onChange={(e) => setMessageContent(e.target.value)}
												placeholder='Saisissez votre message ici...'
												required
												className='w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-secondary'
											/>
										</div>
									</div>

									{/* Action buttons */}
									<div className='p-4 bg-gray-50 flex justify-end gap-3 border-t'>
										<button
											type='button'
											onClick={closeNewMessageModal}
											className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200'>
											Annuler
										</button>
										<button
											type='submit'
											disabled={sending}
											className='px-4 py-2 bg-secondary text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'>
											{sending ? 'Envoi en cours...' : 'Envoyer'}
											{!sending && <MdSend />}
										</button>
									</div>
								</form>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Archived Messages Modal */}
			<AnimatePresence>
				{showArchivedMessages && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
						<ArchivedMessagesView
							user={user}
							onClose={() => setShowArchivedMessages(false)}
							onSuccess={(message) => {
								setSuccess(message);
								setTimeout(() => setSuccess(''), 3000);
								// Refresh messages after restoration
								fetchMessages();
							}}
							onError={(message) => setError(message)}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default MessagesPage;
