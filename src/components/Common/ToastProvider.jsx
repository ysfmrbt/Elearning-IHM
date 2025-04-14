import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from './Toast';

// Create context
const ToastContext = createContext();

/**
 * Toast provider component to manage toast notifications
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const ToastProvider = ({ children }) => {
	const [toasts, setToasts] = useState([]);

	// Add a new toast
	const addToast = useCallback(
		(type, message, duration = 5000, position = 'top-right') => {
			const id = Date.now().toString();
			setToasts((prevToasts) => [
				...prevToasts,
				{ id, type, message, duration, position },
			]);
			return id;
		},
		[],
	);

	// Remove a toast by id
	const removeToast = useCallback((id) => {
		setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
	}, []);

	// Convenience methods for different toast types
	const success = useCallback(
		(message, duration, position) => {
			return addToast('success', message, duration, position);
		},
		[addToast],
	);

	const error = useCallback(
		(message, duration, position) => {
			return addToast('error', message, duration, position);
		},
		[addToast],
	);

	const warning = useCallback(
		(message, duration, position) => {
			return addToast('warning', message, duration, position);
		},
		[addToast],
	);

	const info = useCallback(
		(message, duration, position) => {
			return addToast('info', message, duration, position);
		},
		[addToast],
	);

	return (
		<ToastContext.Provider
			value={{ addToast, removeToast, success, error, warning, info }}>
			{children}
			<div className='fixed top-20 right-4 z-50 flex flex-col items-end space-y-2 max-w-md'>
				{toasts.map((toast) => (
					<Toast
						key={toast.id}
						type={toast.type}
						message={toast.message}
						duration={toast.duration}
						position={toast.position}
						onClose={() => removeToast(toast.id)}
					/>
				))}
			</div>
		</ToastContext.Provider>
	);
};

// Custom hook to use the toast context
export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider');
	}
	return context;
};

export default ToastProvider;
