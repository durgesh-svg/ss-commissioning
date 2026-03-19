import { Component } from 'react'
import { logError } from '../lib/errorLogger'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    logError({
      message: error.message,
      stack: error.stack + '\n\nComponent Stack:\n' + info.componentStack,
      context: { type: 'react_error_boundary' },
      userId: this.props.userId,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-2xl shadow p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4">This error has been logged automatically.</p>
            <p className="text-xs text-red-400 bg-red-50 rounded p-2 mb-4 text-left break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="w-full py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#d85a30' }}
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
