import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API = "https://ircshrmbackend.stackenzo.com";

const EMPLOYEES_API = `${API}/api/hr/employees/assigned`;
const REQUESTS_API = `${API}/api/fill/shift-change-requests-departments`;

const getToken = () => localStorage.getItem("hrmToken");

const getUser = () => {
    try {
        return JSON.parse(localStorage.getItem("hrmUser") || "{}");
    } catch {
        return {};
    }
};

const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json"
});

const formatTime = (time) => {
    if (!time) return "--";

    const [hours, minutes] = String(time).split(":");

    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
};

const formatDate = (date) => {
    if (!date) return "--";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
};

export default function Dashboard() {
    const navigate = useNavigate();

    const user = getUser();

    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [requests, setRequests] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [processingId, setProcessingId] = useState(null);

    // Shift update modal
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedShift, setSelectedShift] = useState("");
    const [updatingShift, setUpdatingShift] = useState(false);

    // Rejection reasons
    const [rejectionReasons, setRejectionReasons] = useState({});

    const [successMessage, setSuccessMessage] = useState("");

    // Apply leave on behalf of an assigned employee
    const [leaveForm, setLeaveForm] = useState({
        employee_code: "",
        from_date: "",
        to_date: "",
        leave_type: "FULL_DAY",
        reason: ""
    });
    const [submittingLeave, setSubmittingLeave] = useState(false);

    const isLoggedIn = Boolean(
        getToken() && user.employee_id
    );

    // =====================================================
    // FETCH ASSIGNED EMPLOYEES
    // =====================================================

    const fetchEmployees = useCallback(async () => {
        const response = await fetch(EMPLOYEES_API, {
            headers: authHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to fetch employees");
        }

        setEmployees(result.employees || []);
        setShifts(result.available_shifts || []);
    }, []);

    // =====================================================
    // FETCH DEPARTMENT SHIFT REQUESTS
    // =====================================================

    const fetchRequests = useCallback(async () => {
        const response = await fetch(
            `${REQUESTS_API}?status=PENDING&date=today&page=1&limit=100`,
            {
                headers: authHeaders()
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Failed to fetch shift requests"
            );
        }

        setRequests(result.data || []);
    }, []);

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            await Promise.all([
                fetchEmployees(),
                fetchRequests()
            ]);

        } catch (err) {
            setError(err.message || "Unable to load dashboard");
        } finally {
            setLoading(false);
        }
    }, [fetchEmployees, fetchRequests]);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true });
            return;
        }

        loadDashboard();
    }, [isLoggedIn, navigate, loadDashboard]);

    // =====================================================
    // OPEN SHIFT MODAL
    // =====================================================

    const openShiftModal = (employee) => {
        setSelectedEmployee(employee);
        setSelectedShift(employee.shift_id || "");
        setShowShiftModal(true);
    };

    // =====================================================
    // UPDATE EMPLOYEE SHIFT
    // =====================================================

    const handleShiftUpdate = async () => {
        if (!selectedEmployee || !selectedShift) {
            alert("Please select a shift.");
            return;
        }

        try {
            setUpdatingShift(true);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API}/api/hr/employees/${selectedEmployee.employee_id}/shift`,
                {
                    method: "PUT",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        shift_id: selectedShift
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to update shift"
                );
            }

            setSuccessMessage(
                `Shift updated successfully for ${selectedEmployee.employee_code}`
            );

            setShowShiftModal(false);
            setSelectedEmployee(null);

            await fetchEmployees();

        } catch (err) {
            setError(err.message);
        } finally {
            setUpdatingShift(false);
        }
    };

    // =====================================================
    // APPROVE SHIFT CHANGE REQUEST
    // =====================================================

    const handleApprove = async (request, action) => {
        if (!request.requested_shift_id) {
            alert("Requested shift ID is missing.");
            return;
        }

        const actionText =
            action === "APPROVE_TODAY"
                ? "approve this shift for today"
                : "approve this shift for the entire week";

        if (!window.confirm(`Are you sure you want to ${actionText}?`)) {
            return;
        }

        try {
            setProcessingId(request.request_id);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API}/api/fill/shift-change-requests/${request.request_id}/decision`,
                {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        action,
                        requested_shift_id: request.requested_shift_id
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to approve request"
                );
            }

            setSuccessMessage(result.message || "Request approved successfully.");

            await Promise.all([
                fetchRequests(),
                fetchEmployees()
            ]);

        } catch (err) {
            setError(err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // =====================================================
    // REJECT SHIFT CHANGE REQUEST
    // =====================================================

    const handleReject = async (request) => {
        const reason = rejectionReasons[request.request_id]?.trim();

        if (!reason) {
            alert("Please enter a rejection reason.");
            return;
        }

        if (!window.confirm("Are you sure you want to reject this request?")) {
            return;
        }

        try {
            setProcessingId(request.request_id);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API}/api/fill/shift-change-requests/${request.request_id}/decision`,
                {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        action: "REJECT",
                        rejection_reason: reason
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to reject request"
                );
            }

            setSuccessMessage(result.message || "Request rejected successfully.");

            await fetchRequests();

        } catch (err) {
            setError(err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // =====================================================
    // APPLY LEAVE ON BEHALF OF ASSIGNED EMPLOYEE
    // =====================================================

    const handleLeaveSubmit = async (event) => {
        event.preventDefault();

        const payload = {
            employee_code: leaveForm.employee_code.trim(),
            from_date: leaveForm.from_date,
            to_date: leaveForm.to_date,
            leave_type: leaveForm.leave_type,
            reason: leaveForm.reason.trim()
        };

        if (
            !payload.employee_code ||
            !payload.from_date ||
            !payload.to_date ||
            !payload.leave_type ||
            !payload.reason
        ) {
            setError("Please complete all leave request fields.");
            return;
        }

        if (payload.from_date > payload.to_date) {
            setError("To date must be on or after from date.");
            return;
        }

        if (
            payload.leave_type !== "MULTI_DAY" &&
            payload.from_date !== payload.to_date
        ) {
            setError(`${payload.leave_type} leave must be for a single date.`);
            return;
        }

        if (
            payload.leave_type === "MULTI_DAY" &&
            payload.from_date === payload.to_date
        ) {
            setError("Multi-day leave must cover more than one date.");
            return;
        }

        try {
            setSubmittingLeave(true);
            setError("");
            setSuccessMessage("");

            const response = await fetch(
                `${API}/api/fill/leaveRequest/on-behalf`,
                {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to submit leave request");
            }

            setSuccessMessage(
                `Leave request submitted for ${result.employee?.employee_code || payload.employee_code}. Status: ${result.leave?.status || "PENDING"}.`
            );

            setLeaveForm({
                employee_code: "",
                from_date: "",
                to_date: "",
                leave_type: "FULL_DAY",
                reason: ""
            });

        } catch (err) {
            setError(err.message || "Unable to submit leave request");
        } finally {
            setSubmittingLeave(false);
        }
    };

    // =====================================================
    // LOGOUT
    // =====================================================

    const handleLogout = () => {
        localStorage.removeItem("hrmToken");
        localStorage.removeItem("hrmUser");

        navigate("/login", { replace: true });
    };

    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500 mt-4 text-sm">
                        Loading reporting manager dashboard...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">

            {/* HEADER */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex items-center justify-between">

                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            IRCS HRM
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Reporting Manager Portal
                        </p>
                    </div>

                    <div className="flex items-center gap-4">

                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-semibold text-gray-900">
                                {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                                Reporting Manager
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            {user.first_name?.charAt(0) || "U"}
                        </div>

                        <button
                            onClick={handleLogout}
                            className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
                        >
                            Logout
                        </button>

                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-5 lg:px-8 py-8">

                {/* PAGE TITLE */}
                <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            Reporting Manager Dashboard
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage your assigned employees, shift requests, and leave applications.
                        </p>
                    </div>

                    <button
                        onClick={loadDashboard}
                        className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        ↻ Refresh
                    </button>
                </div>

                {/* ALERTS */}
                {error && (
                    <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between gap-3">
                        <span>{error}</span>
                        <button onClick={() => setError("")}>✕</button>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex justify-between gap-3">
                        <span>{successMessage}</span>
                        <button onClick={() => setSuccessMessage("")}>✕</button>
                    </div>
                )}

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-9">

                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <p className="text-sm text-gray-500">
                            Assigned Employees
                        </p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-2">
                            {employees.length}
                        </h3>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <p className="text-sm text-gray-500">
                            Pending Shift Requests
                        </p>
                        <h3 className="text-3xl font-bold text-orange-600 mt-2">
                            {requests.length}
                        </h3>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <p className="text-sm text-gray-500">
                            Available Shifts
                        </p>
                        <h3 className="text-3xl font-bold text-blue-600 mt-2">
                            {shifts.length}
                        </h3>
                    </div>

                </div>

                {/* ================================================= */}
                {/* SECTION 1: APPLY LEAVE ON BEHALF */}
                {/* ================================================= */}

                <section className="mb-10 bg-white border border-gray-200 rounded-2xl p-5 lg:p-6">
                    <div className="mb-5">
                        <h3 className="text-xl font-bold text-gray-900">
                            Apply Leave on Behalf
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Submit a leave request for an employee assigned to you. The request will follow the normal approval process.
                        </p>
                    </div>

                    <form onSubmit={handleLeaveSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Employee Code
                            </label>
                            <input
                                type="text"
                                value={leaveForm.employee_code}
                                onChange={(e) => setLeaveForm((prev) => ({ ...prev, employee_code: e.target.value }))}
                                placeholder="Example: IRCSCH/005"
                                autoComplete="off"
                                className="w-full h-11 px-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                required
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Only employees actively assigned to your reporting list are eligible.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Leave Type
                            </label>
                            <select
                                value={leaveForm.leave_type}
                                onChange={(e) => setLeaveForm((prev) => ({ ...prev, leave_type: e.target.value }))}
                                className="w-full h-11 px-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                            >
                                <option value="FULL_DAY">Full Day</option>
                                <option value="HALF_DAY">Half Day</option>
                                <option value="MULTI_DAY">Multiple Days</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                From Date
                            </label>
                            <input
                                type="date"
                                value={leaveForm.from_date}
                                onChange={(e) => setLeaveForm((prev) => ({ ...prev, from_date: e.target.value }))}
                                min={new Date().toLocaleDateString("en-CA")}
                                className="w-full h-11 px-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                To Date
                            </label>
                            <input
                                type="date"
                                value={leaveForm.to_date}
                                onChange={(e) => setLeaveForm((prev) => ({ ...prev, to_date: e.target.value }))}
                                min={leaveForm.from_date || new Date().toLocaleDateString("en-CA")}
                                className="w-full h-11 px-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Reason
                            </label>
                            <textarea
                                value={leaveForm.reason}
                                onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                                rows={3}
                                placeholder="Enter the reason for leave"
                                className="w-full px-3 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-y"
                                required
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={submittingLeave}
                                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
                            >
                                {submittingLeave ? "Submitting..." : "Submit Leave Request"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* ================================================= */}
                {/* SECTION 2: SHIFT CHANGE REQUESTS */}
                {/* ================================================= */}

                <section className="mb-10">

                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">
                                Shift Change Requests
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Review and approve or reject employee requests.
                            </p>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-semibold">
                            {requests.length} Pending
                        </span>
                    </div>

                    {requests.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center">
                            <div className="text-4xl mb-3">✓</div>
                            <h4 className="font-semibold text-gray-800">
                                No pending requests
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                                All shift-change requests have been processed.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">

                            {requests.map((request) => {
                                const isProcessing =
                                    processingId === request.request_id;

                                return (
                                    <div
                                        key={request.request_id}
                                        className="bg-white border border-gray-200 rounded-2xl p-5 lg:p-6"
                                    >

                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

                                            {/* EMPLOYEE DETAILS */}
                                            <div className="flex-1">

                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                                                        {request.first_name?.charAt(0) || "E"}
                                                    </div>

                                                    <div>
                                                        <h4 className="font-bold text-gray-900">
                                                            {request.first_name} {request.last_name}
                                                        </h4>
                                                        <p className="text-xs text-gray-500">
                                                            {request.employee_code}
                                                        </p>
                                                    </div>

                                                    <span className="ml-auto lg:ml-3 px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold">
                                                        Pending
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                                    <div className="bg-gray-50 rounded-xl p-3">
                                                        <p className="text-xs text-gray-500 mb-1">
                                                            Current Shift
                                                        </p>
                                                        <p className="font-semibold text-gray-800 text-sm">
                                                            {request.assigned_shift_name || "Not assigned"}
                                                        </p>
                                                    </div>

                                                    <div className="bg-blue-50 rounded-xl p-3">
                                                        <p className="text-xs text-blue-600 mb-1">
                                                            Requested Shift
                                                        </p>
                                                        <p className="font-semibold text-blue-900 text-sm">
                                                            {request.requested_shift_name || "Not specified"}
                                                        </p>
                                                    </div>

                                                </div>
                                            </div>

                                            {/* ACTIONS */}
                                            <div className="w-full lg:w-64 space-y-3">

                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() =>
                                                        handleApprove(request, "APPROVE_TODAY")
                                                    }
                                                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
                                                >
                                                    {isProcessing ? "Processing..." : "Approve Today"}
                                                </button>

                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() =>
                                                        handleApprove(request, "APPROVE_WEEK")
                                                    }
                                                    className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold"
                                                >
                                                    {isProcessing ? "Processing..." : "Approve Week"}
                                                </button>

                                                <input
                                                    type="text"
                                                    placeholder="Rejection reason"
                                                    value={rejectionReasons[request.request_id] || ""}
                                                    onChange={(e) =>
                                                        setRejectionReasons((prev) => ({
                                                            ...prev,
                                                            [request.request_id]: e.target.value
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
                                                />

                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleReject(request)}
                                                    className="w-full py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-semibold"
                                                >
                                                    Reject Request
                                                </button>

                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                        </div>
                    )}
                </section>

                {/* ================================================= */}
                {/* SECTION 3: ASSIGNED EMPLOYEES */}
                {/* ================================================= */}

                <section>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">
                                Assigned Employees
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                View and manage shifts for employees assigned to you.
                            </p>
                        </div>

                        <span className="text-sm text-gray-500">
                            {employees.length} Employees
                        </span>
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden">

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">

                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                                            Employee
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                                            Employee Code
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                                            Present Shift
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                                            Shift Timing
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">

                                    {employees.map((employee) => {
                                        return (
                                            <tr
                                                key={employee.employee_id}
                                                className="hover:bg-gray-50"
                                            >

                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-sm text-gray-900">
                                                        {employee.first_name} {employee.middle_name} {employee.last_name}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {employee.employee_code}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
                                                        {employee.shift_name || "Not assigned"}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {employee.start_time
                                                        ? `${formatTime(employee.start_time)} - ${formatTime(employee.end_time)}`
                                                        : "--"}
                                                </td>

                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => openShiftModal(employee)}
                                                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                                                    >
                                                        Change Shift
                                                    </button>
                                                </td>

                                            </tr>
                                        );
                                    })}

                                </tbody>
                            </table>
                        </div>

                    </div>

                    {/* MOBILE CARDS */}
                    <div className="md:hidden space-y-4">

                        {employees.map((employee) => {
                            return (
                                <div
                                    key={employee.employee_id}
                                    className="bg-white border border-gray-200 rounded-xl p-4"
                                >

                                    <div className="mb-3">
                                        <h4 className="font-bold text-gray-900 text-sm">
                                            {employee.first_name} {employee.middle_name} {employee.last_name}
                                        </h4>
                                        <p className="text-xs text-gray-500">
                                            {employee.employee_code}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                        <p className="text-xs text-gray-500 mb-1">
                                            Present Shift
                                        </p>
                                        <p className="font-semibold text-gray-800 text-sm">
                                            {employee.shift_name || "Not assigned"}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {employee.start_time
                                                ? `${formatTime(employee.start_time)} - ${formatTime(employee.end_time)}`
                                                : "--"}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => openShiftModal(employee)}
                                        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                                    >
                                        Change Shift
                                    </button>

                                </div>
                            );
                        })}

                        {employees.length === 0 && (
                            <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                                No employees are currently assigned to you.
                            </div>
                        )}
                    </div>

                </section>

            </main>

            {/* ================================================= */}
            {/* SHIFT CHANGE MODAL */}
            {/* ================================================= */}

            {showShiftModal && selectedEmployee && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    Change Shift
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {selectedEmployee.employee_code}
                                </p>
                            </div>

                            <button
                                onClick={() => setShowShiftModal(false)}
                                className="text-gray-400 hover:text-gray-800 text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-5">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Current Shift
                            </label>

                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                                <p className="font-semibold text-gray-800">
                                    {selectedEmployee.shift_name || "Not assigned"}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {selectedEmployee.start_time
                                        ? `${formatTime(selectedEmployee.start_time)} - ${formatTime(selectedEmployee.end_time)}`
                                        : "--"}
                                </p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Select New Shift
                            </label>

                            <select
                                value={selectedShift}
                                onChange={(e) => setSelectedShift(e.target.value)}
                                className="w-full h-12 px-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            >
                                <option value="">
                                    Select a shift
                                </option>

                                {shifts.map((shift) => (
                                    <option
                                        key={shift.shift_id}
                                        value={shift.shift_id}
                                    >
                                        {shift.shift_name} (
                                        {shift.start_time_normal || formatTime(shift.start_time)}
                                        {" - "}
                                        {shift.end_time_normal || formatTime(shift.end_time)}
                                        )
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3">

                            <button
                                onClick={() => setShowShiftModal(false)}
                                disabled={updatingShift}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleShiftUpdate}
                                disabled={updatingShift || !selectedShift}
                                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm"
                            >
                                {updatingShift ? "Updating..." : "Update Shift"}
                            </button>

                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}