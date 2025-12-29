import React, { Component, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error for debugging (only in development)
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
                    <div className="bg-slate-900 rounded-[3rem] p-12 max-w-lg w-full text-center border border-slate-800 shadow-2xl">
                        {/* Error Icon */}
                        <div className="w-24 h-24 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
                            <AlertTriangle className="w-12 h-12 text-rose-500" />
                        </div>

                        {/* Error Message */}
                        <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
                            Đã xảy ra lỗi
                        </h1>
                        <p className="text-slate-400 mb-8 leading-relaxed">
                            Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp tục.
                        </p>

                        {/* Error Details (only in development) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="mb-8 p-4 bg-slate-800/50 rounded-2xl text-left border border-slate-700">
                                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">
                                    Chi tiết lỗi (Dev Mode)
                                </p>
                                <code className="text-xs text-slate-400 break-all">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}

                        {/* Retry Button */}
                        <button
                            onClick={this.handleRetry}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Tải lại trang
                        </button>

                        {/* Support Link */}
                        <p className="mt-6 text-slate-500 text-xs">
                            Nếu lỗi vẫn tiếp tục, vui lòng liên hệ{' '}
                            <a href="mailto:support@engpractice.pro" className="text-indigo-400 hover:text-indigo-300 underline">
                                support@engpractice.pro
                            </a>
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
