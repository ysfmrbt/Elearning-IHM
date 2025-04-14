import React, { useEffect, useState } from 'react';
import {
	MdCheckCircle,
	MdError,
	MdInfo,
	MdWarning,
	MdClose,
} from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Toast notification component
 * @param {Object} props - Component props
 * @param {string} props.type - Type of toast: 'success', 'error', 'info', 'warning'
 * @param {string} props.message - Message to display
 * @param {number} props.duration - Duration in milliseconds before auto-closing
 * @param {Function} props.onClose - Function to call when toast is closed
 * @param {boolean} props.showProgress - Whether to show progress bar
 */
const Toast = ({
	type = 'info',
	message,
	duration = 5000,
	onClose,
	showProgress = true,
}) => {
	const [progress, setProgress] = useState(100);
	const [intervalId, setIntervalId] = useState(null);

	// Define toast styles based on type
	const toastStyles = {
		success: {
			bg: 'bg-green-50',
			border: 'border-green-500',
			text: 'text-green-800',
			icon: <MdCheckCircle className='w-6 h-6 text-green-500' />,
			progress: 'bg-green-500',
		},
		error: {
			bg: 'bg-red-50',
			border: 'border-red-500',
			text: 'text-red-800',
			icon: <MdError className='w-6 h-6 text-red-500' />,
			progress: 'bg-red-500',
		},
		warning: {
			bg: 'bg-yellow-50',
			border: 'border-yellow-500',
			text: 'text-yellow-800',
			icon: <MdWarning className='w-6 h-6 text-yellow-500' />,
			progress: 'bg-yellow-500',
		},
		info: {
			bg: 'bg-blue-50',
			border: 'border-blue-500',
			text: 'text-blue-800',
			icon: <MdInfo className='w-6 h-6 text-blue-500' />,
			progress: 'bg-blue-500',
		},
	};

	const style = toastStyles[type] || toastStyles.info;

	// Set up progress bar and auto-close
	useEffect(() => {
		if (duration && duration > 0) {
			// Calculate interval for smooth progress bar
			const interval = duration / 100;

			// Set up interval to update progress
			const id = setInterval(() => {
				setProgress((prev) => {
					if (prev <= 0) {
						clearInterval(id);
						return 0;
					}
					return prev - 1;
				});
			}, interval);

			setIntervalId(id);

			// Set up timeout to close toast
			const timeout = setTimeout(() => {
				if (onClose) onClose();
			}, duration);

			// Clean up on unmount
			return () => {
				clearInterval(id);
				clearTimeout(timeout);
			};
		}
	}, [duration, onClose]);

	// Handle manual close
	const handleClose = () => {
		if (intervalId) clearInterval(intervalId);
		if (onClose) onClose();
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
			className={`${style.bg} border-l-4 ${style.border} ${style.text} p-4 rounded shadow-md relative overflow-hidden w-full`}
			role='alert'>
			<div className='flex items-center'>
				<div className='flex-shrink-0 mr-3'>{style.icon}</div>
				<div className='flex-grow'>
					<p className='font-medium'>{message}</p>
				</div>
				<div>
					<button
						onClick={handleClose}
						className='ml-auto text-gray-400 hover:text-gray-600 focus:outline-none'
						aria-label='Close'>
						<MdClose className='w-5 h-5' />
					</button>
				</div>
			</div>

			{showProgress && (
				<div className='absolute bottom-0 left-0 h-1 w-full bg-gray-200'>
					<div
						className={`h-full ${style.progress} transition-all duration-300 ease-linear`}
						style={{ width: `${progress}%` }}
					/>
				</div>
			)}
		</motion.div>
	);
};

export default Toast;
