
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "https://ircshrmbackend.stackenzo.com";

const EMPLOYEES_API = `${API}/api/hr/employees/assigned`;
const LEAVE_API = `${API}/api/fill/leaveRequest`;
const PERMISSION_API = `${API}/api/fill/permissionRequest`;
const WORKOFF_FETCH_API = `${API}/api/fill/workoff/available`;

// Assumed application endpoint: confirm that this POST route exists
// in your backend. The available-workoff GET route is already confirmed.
const WORKOFF_APPLY_API = `${API}/api/fill/workoff/apply`;

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

const getToday = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000)
        .toISOString()
        .slice(0, 10);
};

const formatDate = (date) => {
    if (!date) return "--";

    return new Date(`${String(date).slice(0, 10)}T00:00:00`)
        .toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
};

const getEmployeeName = (employee) =>
    [
        employee?.first_name,
        employee?.middle_name,
        employee?.last_name
    ].filter(Boolean).join(" ");

const initialLeaveForm = {
    employee_code: "",
    from_date: getToday(),
    to_date: getToday(),
    leave_type: "FULL_DAY",
    half_day_period: "FIRST_HALF",
    reason: ""
};

const initialPermissionForm = {
    employee_code: "",
    date: getToday(),
    from_time: "",
    to_time: "",
    reason: ""
};

const initialWorkoffForm = {
    employee_code: "",
    workoff_id: "",
    workoff_date: getToday()
};

export default function Dashboard() {
    const navigate = useNavigate();
    const user = getUser();

    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Leave
    const [leaveForm, setLeaveForm] = useState(initialLeaveForm);
    const [submittingLeave, setSubmittingLeave] = useState(false);

    // Permission
    const [permissionForm, setPermissionForm] = useState(
        initialPermissionForm
    );
    const [submittingPermission, setSubmittingPermission] = useState(false);

    // Workoff
    const [workoffForm, setWorkoffForm] = useState(initialWorkoffForm);
    const [availableWorkoffs, setAvailableWorkoffs] = useState([]);
    const [workoffEmployee, setWorkoffEmployee] = useState(null);
    const [fetchingWorkoffs, setFetchingWorkoffs] = useState(false);
    const [applyingWorkoff, setApplyingWorkoff] = useState(false);

    // Shift modal
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedShift, setSelectedShift] = useState("");
    const [updatingShift, setUpdatingShift] = useState(false);

    const isLoggedIn = Boolean(getToken() && user.employee_id);

    // -----------------------------------------------------
    // COMMON HELPERS
    // -----------------------------------------------------

    const clearMessages = () => {
        setError("");
        setSuccessMessage("");
    };

    const showSuccess = (message) => {
        setError("");
        setSuccessMessage(message);
    };

    const findAssignedEmployee = (employeeCode) => {
        const code = employeeCode.trim().toLowerCase();

        if (!code) return null;

        return employees.find(
            (employee) =>
                String(employee.employee_code).trim().toLowerCase() === code
        );
    };

    const parseResponse = async (response) => {
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.message || result.error || "Request failed"
            );
        }

        return result;
    };

    // -----------------------------------------------------
    // FETCH EMPLOYEES AND SHIFTS
    // -----------------------------------------------------

    const fetchEmployees = useCallback(async () => {
        const response = await fetch(EMPLOYEES_API, {
            headers: authHeaders()
        });

        const result = await parseResponse(response);

        setEmployees(result.employees || []);
        setShifts(result.available_shifts || []);
    }, []);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            await fetchEmployees();
        } catch (err) {
            setError(err.message || "Unable to load dashboard");
        } finally {
            setLoading(false);
        }
    }, [fetchEmployees]);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate("/login", { replace: true });
            return;
        }

        loadDashboard();
    }, [isLoggedIn, navigate, loadDashboard]);

    // -----------------------------------------------------
    // LEAVE REQUEST
    // -----------------------------------------------------

    const handleLeaveSubmit = async (event) => {
        event.preventDefault();
        clearMessages();

        const employee = findAssignedEmployee(leaveForm.employee_code);

        if (!employee) {
            setError("Employee code not found in your assigned employee list.");
            return;
        }

        const {
            from_date,
            to_date,
            leave_type,
            half_day_period,
            reason
        } = leaveForm;

        if (!from_date || !reason.trim()) {
            setError("Please complete all required leave fields.");
            return;
        }

        const finalToDate =
            leave_type === "MULTI_DAY" ? to_date : from_date;

        if (!finalToDate) {
            setError("Please select the leave end date.");
            return;
        }

        if (from_date > finalToDate) {
            setError("To date must be on or after from date.");
            return;
        }

        if (
            leave_type === "MULTI_DAY" &&
            from_date === finalToDate
        ) {
            setError("Multi Day leave must cover more than one date.");
            return;
        }

        if (
            leave_type === "HALF_DAY" &&
            !["FIRST_HALF", "SECOND_HALF"].includes(half_day_period)
        ) {
            setError("Please select First Half or Second Half.");
            return;
        }

        const payload = {
            userId: employee.employee_id,
            from_date,
            to_date: finalToDate,
            leave_type,
            half_day_period:
                leave_type === "HALF_DAY" ? half_day_period : null,
            reason: reason.trim()
        };

        try {
            setSubmittingLeave(true);

            const response = await fetch(LEAVE_API, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            const result = await parseResponse(response);

            showSuccess(
                `Leave request submitted for ${employee.employee_code}. Status: ${result.leave?.status || result.status || "PENDING"}.`
            );

            setLeaveForm(initialLeaveForm);
        } catch (err) {
            setError(err.message || "Unable to submit leave request.");
        } finally {
            setSubmittingLeave(false);
        }
    };

    // -----------------------------------------------------
    // PERMISSION REQUEST
    // -----------------------------------------------------

    const handlePermissionSubmit = async (event) => {
        event.preventDefault();
        clearMessages();

        const employee = findAssignedEmployee(
            permissionForm.employee_code
        );

        if (!employee) {
            setError("Employee code not found in your assigned employee list.");
            return;
        }

        const {
            date,
            from_time,
            to_time,
            reason
        } = permissionForm;

        if (!date || !from_time || !to_time || !reason.trim()) {
            setError("Please complete all permission fields.");
            return;
        }

        if (from_time >= to_time) {
            setError("To time must be later than From time.");
            return;
        }

        // Convert local IST date/time to ISO timestamps.
        const requested_from = new Date(
            `${date}T${from_time}:00+05:30`
        ).toISOString();

        const requested_to = new Date(
            `${date}T${to_time}:00+05:30`
        ).toISOString();

        const payload = {
            userId: employee.employee_id,
            requested_from,
            requested_to,
            reason: reason.trim()
        };

        try {
            setSubmittingPermission(true);

            const response = await fetch(PERMISSION_API, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            const result = await parseResponse(response);

            showSuccess(
                `Permission request submitted for ${employee.employee_code}. Status: ${result.status || "PENDING"}.`
            );

            setPermissionForm(initialPermissionForm);
        } catch (err) {
            setError(err.message || "Unable to submit permission request.");
        } finally {
            setSubmittingPermission(false);
        }
    };

    // -----------------------------------------------------
    // FETCH AVAILABLE WORKOFFS
    // -----------------------------------------------------

    const handleFetchWorkoffs = async (event) => {
        event.preventDefault();
        clearMessages();

        const employee = findAssignedEmployee(
            workoffForm.employee_code
        );

        if (!employee) {
            setError("Employee code not found in your assigned employee list.");
            return;
        }

        try {
            setFetchingWorkoffs(true);
            setAvailableWorkoffs([]);
            setWorkoffEmployee(null);

            const response = await fetch(
                `${WORKOFF_FETCH_API}/${encodeURIComponent(employee.employee_code)}`,
                {
                    headers: authHeaders()
                }
            );

            const result = await parseResponse(response);

            const workoffs = result.workoffs || [];

            setAvailableWorkoffs(workoffs);
            setWorkoffEmployee(result.employee || employee);

            setWorkoffForm((prev) => ({
                ...prev,
                workoff_id: ""
            }));

            if (workoffs.length === 0) {
                showSuccess(
                    `No available approved workoffs found for ${employee.employee_code}.`
                );
            } else {
                showSuccess(
                    `${workoffs.length} available workoff(s) found for ${employee.employee_code}.`
                );
            }
        } catch (err) {
            setError(err.message || "Unable to fetch available workoffs.");
        } finally {
            setFetchingWorkoffs(false);
        }
    };

    // -----------------------------------------------------
    // APPLY WORKOFF
    // -----------------------------------------------------

    const handleWorkoffApply = async (event) => {
        event.preventDefault();
        clearMessages();

        const employee = findAssignedEmployee(
            workoffForm.employee_code
        );

        if (!employee) {
            setError("Employee code not found in your assigned employee list.");
            return;
        }

        if (!workoffForm.workoff_id) {
            setError("Please select an available workoff.");
            return;
        }

        if (!workoffForm.workoff_date) {
            setError("Please select the date for applying the workoff.");
            return;
        }

        const selectedWorkoff = availableWorkoffs.find(
            (workoff) =>
                String(workoff.workoff_id) ===
                String(workoffForm.workoff_id)
        );

        if (!selectedWorkoff) {
            setError("Selected workoff is no longer available. Fetch again.");
            return;
        }

        const payload = {
            employee_code: employee.employee_code,
            workoff_id: selectedWorkoff.workoff_id,
            workoff_date: workoffForm.workoff_date
        };

        try {
            setApplyingWorkoff(true);

            const response = await fetch(WORKOFF_APPLY_API, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            const result = await parseResponse(response);

            showSuccess(
                result.message ||
                `Workoff application submitted for ${employee.employee_code}.`
            );

            setAvailableWorkoffs((prev) =>
                prev.filter(
                    (workoff) =>
                        String(workoff.workoff_id) !==
                        String(selectedWorkoff.workoff_id)
                )
            );

            setWorkoffForm((prev) => ({
                ...prev,
                workoff_id: ""
            }));
        } catch (err) {
            setError(
                err.message ||
                "Unable to apply workoff. Please check the backend route."
            );
        } finally {
            setApplyingWorkoff(false);
        }
    };

    // -----------------------------------------------------
    // SHIFT UPDATE
    // -----------------------------------------------------

    const openShiftModal = (employee) => {
        setSelectedEmployee(employee);
        setSelectedShift(employee.shift_id || "");
        setShowShiftModal(true);
    };

    const handleShiftUpdate = async () => {
        if (!selectedEmployee || !selectedShift) {
            setError("Please select a shift.");
            return;
        }

        try {
            setUpdatingShift(true);
            clearMessages();

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

            const result = await parseResponse(response);

            showSuccess(
                result.message ||
                `Shift updated successfully for ${selectedEmployee.employee_code}.`
            );

            setShowShiftModal(false);
            setSelectedEmployee(null);

            await fetchEmployees();
        } catch (err) {
            setError(err.message || "Failed to update employee shift.");
        } finally {
            setUpdatingShift(false);
        }
    };

    // -----------------------------------------------------
    // LOGOUT
    // -----------------------------------------------------

    const handleLogout = () => {
        localStorage.removeItem("hrmToken");
        localStorage.removeItem("hrmUser");
        navigate("/login", { replace: true });
    };

    // -----------------------------------------------------
    // LOADING
    // -----------------------------------------------------

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-500 mt-4 text-sm">
                        Loading reporting manager dashboard...
                    </p>
                </div>
            </div>
        );
    }

    // -----------------------------------------------------
    // REUSABLE INPUT STYLES
    // -----------------------------------------------------

    const inputClass =
        "w-full min-w-0 h-11 px-3 border border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

    const labelClass =
        "block text-sm font-semibold text-gray-700 mb-2";

    const buttonClass =
        "w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition";

    return (
        <div className="min-h-screen bg-gray-50">

            {/* HEADER */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">

                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                            IRCS HRM
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Reporting Manager Portal
                        </p>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">

                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-semibold text-gray-900">
                                {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                                Reporting Manager
                            </p>
                        </div>

                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                            {user.first_name?.charAt(0) || "U"}
                        </div>

                        <button
                            onClick={handleLogout}
                            className="text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">

                {/* PAGE TITLE */}
                <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                            Reporting Manager Dashboard
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage employee leave, permissions, workoffs and shifts.
                        </p>
                    </div>

                    <button
                        onClick={loadDashboard}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        ↻ Refresh Dashboard
                    </button>
                </div>

                {/* ALERTS */}
                {error && (
                    <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between gap-3">
                        <span className="break-words">{error}</span>
                        <button
                            onClick={() => setError("")}
                            className="shrink-0 font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex justify-between gap-3">
                        <span className="break-words">{successMessage}</span>
                        <button
                            onClick={() => setSuccessMessage("")}
                            className="shrink-0 font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* SUMMARY */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-7 sm:mb-9">

                    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                        <p className="text-xs sm:text-sm text-gray-500">
                            Assigned Employees
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
                            {employees.length}
                        </h3>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                        <p className="text-xs sm:text-sm text-gray-500">
                            Available Shifts
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">
                            {shifts.length}
                        </h3>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                        <p className="text-xs sm:text-sm text-gray-500">
                            Available Workoffs Fetched
                        </p>
                        <h3 className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
                            {availableWorkoffs.length}
                        </h3>
                    </div>
                </div>

                {/* ================================================= */}
                {/* LEAVE REQUEST */}
                {/* ================================================= */}

                <section className="mb-6 sm:mb-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">

                    <div className="mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl">
                                📅
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                                    Leave Request
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500">
                                    Submit a leave request for an assigned employee.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form
                        onSubmit={handleLeaveSubmit}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >

                        <div>
                            <label className={labelClass}>
                                Employee Code
                            </label>
                            <input
                                className={inputClass}
                                placeholder="Example: IRCSCH/005"
                                value={leaveForm.employee_code}
                                onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                        ...prev,
                                        employee_code: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>
                                Leave Type
                            </label>
                            <select
                                className={inputClass}
                                value={leaveForm.leave_type}
                                onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                        ...prev,
                                        leave_type: e.target.value,
                                        to_date:
                                            e.target.value === "MULTI_DAY"
                                                ? prev.to_date
                                                : prev.from_date
                                    }))
                                }
                            >
                                <option value="FULL_DAY">Full Day</option>
                                <option value="HALF_DAY">Half Day</option>
                                <option value="MULTI_DAY">Multi Day</option>
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>
                                From Date
                            </label>
                            <input
                                type="date"
                                className={inputClass}
                                value={leaveForm.from_date}
                                onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                        ...prev,
                                        from_date: e.target.value,
                                        to_date:
                                            prev.leave_type === "MULTI_DAY"
                                                ? prev.to_date
                                                : e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        {leaveForm.leave_type === "MULTI_DAY" && (
                            <div>
                                <label className={labelClass}>
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    min={leaveForm.from_date}
                                    className={inputClass}
                                    value={leaveForm.to_date}
                                    onChange={(e) =>
                                        setLeaveForm((prev) => ({
                                            ...prev,
                                            to_date: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>
                        )}

                        {leaveForm.leave_type === "HALF_DAY" && (
                            <div className="sm:col-span-2">
                                <label className={labelClass}>
                                    Half Day Period
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer ${
                                        leaveForm.half_day_period === "FIRST_HALF"
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-gray-200"
                                    }`}>
                                        <input
                                            type="radio"
                                            name="half_day_period"
                                            value="FIRST_HALF"
                                            checked={
                                                leaveForm.half_day_period === "FIRST_HALF"
                                            }
                                            onChange={(e) =>
                                                setLeaveForm((prev) => ({
                                                    ...prev,
                                                    half_day_period: e.target.value
                                                }))
                                            }
                                        />
                                        <span className="text-sm font-medium">
                                            First Half
                                        </span>
                                    </label>

                                    <label className={`flex items-center gap-2 border rounded-xl p-3 cursor-pointer ${
                                        leaveForm.half_day_period === "SECOND_HALF"
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-gray-200"
                                    }`}>
                                        <input
                                            type="radio"
                                            name="half_day_period"
                                            value="SECOND_HALF"
                                            checked={
                                                leaveForm.half_day_period === "SECOND_HALF"
                                            }
                                            onChange={(e) =>
                                                setLeaveForm((prev) => ({
                                                    ...prev,
                                                    half_day_period: e.target.value
                                                }))
                                            }
                                        />
                                        <span className="text-sm font-medium">
                                            Second Half
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="sm:col-span-2">
                            <label className={labelClass}>
                                Reason
                            </label>
                            <textarea
                                rows={3}
                                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                placeholder="Enter reason for leave..."
                                value={leaveForm.reason}
                                onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                        ...prev,
                                        reason: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <button
                                type="submit"
                                disabled={submittingLeave}
                                className={buttonClass}
                            >
                                {submittingLeave
                                    ? "Submitting..."
                                    : "Submit Leave Request"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* ================================================= */}
                {/* PERMISSION REQUEST */}
                {/* ================================================= */}

                <section className="mb-6 sm:mb-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">

                    <div className="mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl">
                                ⏱
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                                    Permission Request
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500">
                                    Request permission for a specific time period.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form
                        onSubmit={handlePermissionSubmit}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    >

                        <div>
                            <label className={labelClass}>
                                Employee Code
                            </label>
                            <input
                                className={inputClass}
                                placeholder="Example: IRCSCH/005"
                                value={permissionForm.employee_code}
                                onChange={(e) =>
                                    setPermissionForm((prev) => ({
                                        ...prev,
                                        employee_code: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>
                                Permission Date
                            </label>
                            <input
                                type="date"
                                className={inputClass}
                                value={permissionForm.date}
                                onChange={(e) =>
                                    setPermissionForm((prev) => ({
                                        ...prev,
                                        date: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>
                                From Time
                            </label>
                            <input
                                type="time"
                                className={inputClass}
                                value={permissionForm.from_time}
                                onChange={(e) =>
                                    setPermissionForm((prev) => ({
                                        ...prev,
                                        from_time: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>
                                To Time
                            </label>
                            <input
                                type="time"
                                className={inputClass}
                                value={permissionForm.to_time}
                                onChange={(e) =>
                                    setPermissionForm((prev) => ({
                                        ...prev,
                                        to_time: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className={labelClass}>
                                Reason
                            </label>
                            <textarea
                                rows={3}
                                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                                placeholder="Enter reason for permission..."
                                value={permissionForm.reason}
                                onChange={(e) =>
                                    setPermissionForm((prev) => ({
                                        ...prev,
                                        reason: e.target.value
                                    }))
                                }
                                required
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <button
                                type="submit"
                                disabled={submittingPermission}
                                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition"
                            >
                                {submittingPermission
                                    ? "Submitting..."
                                    : "Submit Permission Request"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* ================================================= */}
                {/* WORKOFF */}
                {/* ================================================= */}

                <section className="mb-8 sm:mb-10 bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">

                    <div className="mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center text-xl">
                                🔄
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                                    Workoff Application
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500">
                                    Fetch approved workoffs and apply one for an employee.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* FETCH WORKOFFS */}
                    <form
                        onSubmit={handleFetchWorkoffs}
                        className="flex flex-col sm:flex-row gap-3"
                    >
                        <div className="flex-1">
                            <label className={labelClass}>
                                Employee Code
                            </label>
                            <input
                                className={inputClass}
                                placeholder="Enter employee code"
                                value={workoffForm.employee_code}
                                onChange={(e) => {
                                    setWorkoffForm((prev) => ({
                                        ...prev,
                                        employee_code: e.target.value,
                                        workoff_id: ""
                                    }));
                                    setAvailableWorkoffs([]);
                                    setWorkoffEmployee(null);
                                }}
                                required
                            />
                        </div>

                        <div className="sm:self-end">
                            <button
                                type="submit"
                                disabled={fetchingWorkoffs}
                                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold"
                            >
                                {fetchingWorkoffs
                                    ? "Fetching..."
                                    : "Fetch Workoffs"}
                            </button>
                        </div>
                    </form>

                    {/* AVAILABLE WORKOFFS */}
                    {workoffEmployee && (
                        <div className="mt-5">

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        {workoffEmployee.name ||
                                            getEmployeeName(workoffEmployee)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {workoffEmployee.employee_code}
                                    </p>
                                </div>

                                <span className="w-fit px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                                    {availableWorkoffs.length} Available
                                </span>
                            </div>

                            {availableWorkoffs.length === 0 ? (
                                <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 text-center">
                                    <p className="text-sm font-semibold text-gray-700">
                                        No available workoffs
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        This employee has no approved, unused workoffs available.
                                    </p>
                                </div>
                            ) : (
                                <form
                                    onSubmit={handleWorkoffApply}
                                    className="space-y-4"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                        {availableWorkoffs.map((workoff) => (
                                            <label
                                                key={workoff.workoff_id}
                                                className={`block border rounded-xl p-4 cursor-pointer transition ${
                                                    String(workoffForm.workoff_id) ===
                                                    String(workoff.workoff_id)
                                                        ? "border-green-500 bg-green-50"
                                                        : "border-gray-200 hover:border-gray-400"
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="radio"
                                                        name="workoff_id"
                                                        value={workoff.workoff_id}
                                                        checked={
                                                            String(workoffForm.workoff_id) ===
                                                            String(workoff.workoff_id)
                                                        }
                                                        onChange={(e) =>
                                                            setWorkoffForm((prev) => ({
                                                                ...prev,
                                                                workoff_id: e.target.value
                                                            }))
                                                        }
                                                        className="mt-1"
                                                    />

                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm text-gray-900">
                                                            Workoff #{workoff.workoff_id}
                                                        </p>

                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Worked Date: {formatDate(workoff.worked_date)}
                                                        </p>

                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Expires: {formatDate(workoff.expires_at)}
                                                        </p>

                                                        {workoff.reason && (
                                                            <p className="text-xs text-gray-600 mt-2 break-words">
                                                                {workoff.reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                        <div>
                                            <label className={labelClass}>
                                                Apply Workoff On
                                            </label>
                                            <input
                                                type="date"
                                                className={inputClass}
                                                value={workoffForm.workoff_date}
                                                onChange={(e) =>
                                                    setWorkoffForm((prev) => ({
                                                        ...prev,
                                                        workoff_date: e.target.value
                                                    }))
                                                }
                                                required
                                            />
                                        </div>

                                        <div className="sm:self-end">
                                            <button
                                                type="submit"
                                                disabled={
                                                    applyingWorkoff ||
                                                    !workoffForm.workoff_id
                                                }
                                                className="w-full px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold"
                                            >
                                                {applyingWorkoff
                                                    ? "Applying..."
                                                    : "Apply Selected Workoff"}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </section>

                {/* ================================================= */}
                {/* ASSIGNED EMPLOYEES */}
                {/* ================================================= */}

                <section>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">
                                Assigned Employees
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                View employees assigned to you and manage their shifts.
                            </p>
                        </div>

                        <span className="text-sm font-semibold text-gray-600">
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
                                    {employees.map((employee) => (
                                        <tr
                                            key={employee.employee_id}
                                            className="hover:bg-gray-50"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-sm text-gray-900">
                                                    {getEmployeeName(employee)}
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
                                                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700"
                                                >
                                                    Change Shift
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {employees.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan="5"
                                                className="py-12 text-center text-gray-500 text-sm"
                                            >
                                                No employees are currently assigned to you.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MOBILE EMPLOYEE CARDS */}
                    <div className="md:hidden space-y-3">

                        {employees.map((employee) => (
                            <div
                                key={employee.employee_id}
                                className="bg-white border border-gray-200 rounded-2xl p-4"
                            >
                                <div className="flex justify-between items-start gap-3">
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-gray-900 break-words">
                                            {getEmployeeName(employee)}
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {employee.employee_code}
                                        </p>
                                    </div>

                                    <span className="shrink-0 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
                                        {employee.shift_name || "No Shift"}
                                    </span>
                                </div>

                                <div className="mt-4 bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-500">
                                        Current Shift Timing
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 mt-1">
                                        {employee.start_time
                                            ? `${formatTime(employee.start_time)} - ${formatTime(employee.end_time)}`
                                            : "--"}
                                    </p>
                                </div>

                                <button
                                    onClick={() => openShiftModal(employee)}
                                    className="w-full mt-3 py-3 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold"
                                >
                                    Change Shift
                                </button>
                            </div>
                        ))}

                        {employees.length === 0 && (
                            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
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
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">

                    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">

                        <div className="flex justify-between items-start mb-6 gap-3">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    Change Shift
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {getEmployeeName(selectedEmployee)}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {selectedEmployee.employee_code}
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    setShowShiftModal(false);
                                    setSelectedEmployee(null);
                                }}
                                className="text-gray-400 hover:text-gray-700 text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-5">
                            <label className={labelClass}>
                                Select New Shift
                            </label>

                            <select
                                value={selectedShift}
                                onChange={(e) =>
                                    setSelectedShift(e.target.value)
                                }
                                className={inputClass}
                            >
                                <option value="">
                                    Select Shift
                                </option>

                                {shifts.map((shift) => (
                                    <option
                                        key={shift.shift_id}
                                        value={shift.shift_id}
                                    >
                                        {shift.shift_name} (
                                        {formatTime(
                                            shift.start_time_normal ||
                                            shift.start_time
                                        )}
                                        {" - "}
                                        {formatTime(
                                            shift.end_time_normal ||
                                            shift.end_time
                                        )}
                                        )
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-3">
                            <button
                                onClick={() => {
                                    setShowShiftModal(false);
                                    setSelectedEmployee(null);
                                }}
                                className="w-full sm:flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleShiftUpdate}
                                disabled={updatingShift || !selectedShift}
                                className="w-full sm:flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
                            >
                                {updatingShift
                                    ? "Updating..."
                                    : "Update Shift"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
