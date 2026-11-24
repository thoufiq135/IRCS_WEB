
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "https://ircshrmbackend.stackenzo.com/api/hr/userLogin";

export default function Login() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });

        setError("");
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!formData.email || !formData.password) {
            setError("Please enter your email and password.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: formData.email.trim(),
                    password: formData.password
                })
            });

            const result = await response.json();

            if (!response.ok || !result.Logintoken) {
                throw new Error(
                    result.message || "Login failed. Please try again."
                );
            }

            // Store authentication token
            localStorage.setItem("hrmToken", result.Logintoken);

            // Store user information
            localStorage.setItem(
                "hrmUser",
                JSON.stringify(result.data)
            );

            // Redirect to dashboard
            navigate("/dashboard", { replace: true });

        } catch (err) {
            setError(
                err.message || "Unable to connect to the server."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white">

            {/* Left section */}
            <div className="hidden lg:flex lg:w-1/2 bg-[#111827] relative overflow-hidden flex-col justify-between p-12 text-white">

                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-gray-900 font-bold text-xl">
                            I
                        </div>

                        <div>
                            <h1 className="text-xl font-bold tracking-wide">
                                IRCS HRM
                            </h1>
                            <p className="text-xs text-gray-400">
                                Human Resource Management
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 max-w-lg">
                    <p className="text-blue-400 text-sm font-semibold uppercase tracking-[0.2em] mb-5">
                        Department Management Portal
                    </p>

                    <h2 className="text-5xl font-bold leading-tight mb-6">
                        Manage your
                        <span className="block text-blue-400">
                            department.
                        </span>
                    </h2>

                    <p className="text-gray-400 text-lg leading-8">
                        A centralized workspace to manage employees,
                        monitor shift schedules, and handle shift
                        change requests efficiently.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mt-12">
                        <div className="border border-white/10 bg-white/5 rounded-xl p-5">
                            <div className="text-2xl mb-2">01</div>
                            <p className="text-sm text-gray-400">
                                Employee Management
                            </p>
                        </div>

                        <div className="border border-white/10 bg-white/5 rounded-xl p-5">
                            <div className="text-2xl mb-2">02</div>
                            <p className="text-sm text-gray-400">
                                Shift Management
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-sm text-gray-500">
                    © {new Date().getFullYear()} IRCS HRM. All rights reserved.
                </div>
            </div>

            {/* Right section */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">

                <div className="w-full max-w-md">

                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            I
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900">
                                IRCS HRM
                            </h1>
                            <p className="text-xs text-gray-500">
                                Department Portal
                            </p>
                        </div>
                    </div>

                    <div className="mb-10">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-6">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.8"
                                stroke="currentColor"
                                className="w-6 h-6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75c-2.7 0-5.25-.6-7.5-1.65Z"
                                />
                            </svg>
                        </div>

                        <h2 className="text-3xl font-bold text-gray-900">
                            Welcome back
                        </h2>

                        <p className="text-gray-500 mt-2">
                            Sign in to access your department dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email address
                            </label>

                            <div className="relative">
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email"
                                    autoComplete="username"
                                    required
                                    className="w-full h-12 px-4 border border-gray-200 rounded-xl outline-none text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-semibold text-gray-700">
                                    Password
                                </label>
                            </div>

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                    className="w-full h-12 px-4 pr-14 border border-gray-200 rounded-xl outline-none text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 hover:text-gray-900"
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                                <svg
                                    className="w-5 h-5 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                    />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold flex items-center justify-center gap-3 transition shadow-lg shadow-gray-900/10"
                        >
                            {loading ? (
                                <>
                                    <svg
                                        className="animate-spin h-5 w-5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
                                        />
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <span>→</span>
                                </>
                            )}
                        </button>

                    </form>

                    <div className="mt-10 pt-6 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-400">
                            Authorized access only. Your account activity
                            may be monitored.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
