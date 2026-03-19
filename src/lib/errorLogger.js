import { supabase } from './supabase'

export async function logError({ message, stack, context = {}, userId = null, severity = 'error' }) {
  try {
    await supabase.from('app_errors').insert({
      message: String(message).slice(0, 500),
      stack: stack ? String(stack).slice(0, 2000) : null,
      context,
      user_id: userId,
      severity,
      url: window.location.href,
      user_agent: navigator.userAgent.slice(0, 200),
    })
  } catch (_) {
    // Never throw from error logger
  }
}

export function initGlobalErrorHandlers(userId) {
  // Catch unhandled JS errors
  window.onerror = (message, source, lineno, colno, error) => {
    logError({ message, stack: error?.stack, context: { source, lineno, colno }, userId })
    return false
  }

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event) => {
    logError({
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      context: { type: 'unhandledrejection' },
      userId,
    })
  }
}
