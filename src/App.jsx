import React, { useState, useEffect, useCallback } from "react";

// Helper function to calculate working days for a given month and year
const calculateMonthlyWorkingDays = (month, year, extraHolidaysCount = 0) => {
  const date = new Date(year, month - 1, 1);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  let nonWorkingDays = 0;
  let secondSaturdayFound = false;
  let saturdayCount = 0;

  for (let i = 1; i <= totalDaysInMonth; i++) {
    date.setDate(i);
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0) {
      nonWorkingDays++;
    } else if (dayOfWeek === 6) {
      saturdayCount++;
      if (saturdayCount === 2 && !secondSaturdayFound) {
        nonWorkingDays++;
        secondSaturdayFound = true;
      }
    }
  }

  const totalCalculatedWorkingDays =
    totalDaysInMonth - nonWorkingDays - extraHolidaysCount;
  return totalCalculatedWorkingDays > 0 ? totalCalculatedWorkingDays : 0;
};

const App = () => {
  const [periodName, setPeriodName] = useState("");
  const [totalWorkingDays, setTotalWorkingDays] = useState(0);
  const [daysAttended, setDaysAttended] = useState("");
  const [extraHolidays, setExtraHolidays] = useState("");
  const [attendancePercentage, setAttendancePercentage] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [showAttendanceDisplayInButton, setShowAttendanceDisplayInButton] =
    useState(false);

  useEffect(() => {
    const today = new Date();
    const currentMonth = today.toLocaleString("default", { month: "long" });
    const currentYear = today.getFullYear();
    setPeriodName(`${currentMonth} ${currentYear}`);

    try {
      const storedRecords = localStorage.getItem("attendanceRecords");
      if (storedRecords) {
        const parsedRecords = JSON.parse(storedRecords);
        setAttendanceRecords(parsedRecords);

        if (parsedRecords.length > 0) {
          const lastRecord = parsedRecords[0];
          handleEditRecord(lastRecord);
        }
      }
    } catch (e) {
      console.error("Failed to load records from local storage:", e);
      setMessage(
        "Failed to load records from your browser's cache. They might be corrupted."
      );
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const parsePeriodName = (name) => {
      const currentYear = new Date().getFullYear();
      let month = null;
      let year = currentYear;

      const match = name
        .toLowerCase()
        .match(
          /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{4})?$/
        );

      if (match) {
        const monthString = match[1];
        const yearString = match[2];

        const monthNames = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const shortMonthNames = [
          "jan",
          "feb",
          "mar",
          "apr",
          "may",
          "jun",
          "jul",
          "aug",
          "sep",
          "oct",
          "nov",
          "dec",
        ];

        month = monthNames.indexOf(monthString) + 1;
        if (month === 0) {
          month = shortMonthNames.indexOf(monthString) + 1;
        }

        if (yearString) {
          year = parseInt(yearString);
        }
      }

      return { month, year };
    };

    const numExtraHolidays = parseInt(extraHolidays) || 0;
    const parsed = parsePeriodName(periodName);

    if (
      parsed.month > 0 &&
      parsed.month <= 12 &&
      parsed.year >= 1900 &&
      parsed.year <= 2100
    ) {
      const calculatedDays = calculateMonthlyWorkingDays(
        parsed.month,
        parsed.year,
        numExtraHolidays
      );
      setTotalWorkingDays(calculatedDays);
    } else {
      setTotalWorkingDays(0);
    }
  }, [periodName, extraHolidays]);

  const calculateAttendance = useCallback(() => {
    const total = parseFloat(totalWorkingDays);
    const attended = parseFloat(daysAttended);

    if (total <= 0) {
      setMessage(
        "Total working days must be greater than zero. Please ensure the period name is valid and there are no excessive extra holidays."
      );
      setMessageType("error");
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false);
      return;
    }

    if (isNaN(attended) || attended < 0) {
      setMessage("Please enter a non-negative number for days attended.");
      setMessageType("error");
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false);
      return;
    }

    if (attended > total) {
      setMessage("Days attended cannot exceed total working days.");
      setMessageType("error");
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false);
      return;
    }

    const percentage = (attended / total) * 100;
    setAttendancePercentage(percentage.toFixed(2));
    setMessage(null);
    setMessageType(null);
    setShowAttendanceDisplayInButton(true);
  }, [totalWorkingDays, daysAttended]);

  const saveOrUpdateAttendance = async () => {
    const total = parseFloat(totalWorkingDays);
    const attended = parseFloat(daysAttended);

    if (
      total <= 0 ||
      isNaN(attended) ||
      attended < 0 ||
      attended > total ||
      !periodName.trim()
    ) {
      setMessage(
        "Please ensure all fields are correctly filled before saving/updating."
      );
      setMessageType("error");
      setShowAttendanceDisplayInButton(false);
      setAttendancePercentage(null);
      return;
    }

    const percentage = (attended / total) * 100;
    setAttendancePercentage(percentage.toFixed(2));
    setShowAttendanceDisplayInButton(true);

    const recordData = {
      periodName: periodName.trim(),
      totalWorkingDays: total,
      daysAttended: attended,
      extraHolidays: parseInt(extraHolidays) || 0,
      attendancePercentage: parseFloat(percentage.toFixed(2)),
      timestamp: new Date().toISOString(),
      id: editingRecordId || crypto.randomUUID(),
    };

    let updatedRecords;
    if (editingRecordId) {
      updatedRecords = attendanceRecords
        .map((rec) => (rec.id === editingRecordId ? recordData : rec))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setMessage("Record updated successfully!");
      setMessageType("success");
    } else {
      updatedRecords = [recordData, ...attendanceRecords].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setMessage("Record saved successfully!");
      setMessageType("success");
      setPeriodName("");
      setDaysAttended("");
      setExtraHolidays("");
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false);
      const today = new Date();
      const currentMonth = today.toLocaleString("default", { month: "long" });
      const currentYear = today.getFullYear();
      setPeriodName(`${currentMonth} ${currentYear}`);
    }

    setAttendanceRecords(updatedRecords);
    localStorage.setItem("attendanceRecords", JSON.stringify(updatedRecords));
  };

  const handleDeleteClick = (e, record) => {
    e.stopPropagation();
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      const updatedRecords = attendanceRecords.filter(
        (rec) => rec.id !== recordToDelete.id
      );
      setAttendanceRecords(updatedRecords);
      localStorage.setItem("attendanceRecords", JSON.stringify(updatedRecords));
      setMessage("Record deleted successfully!");
      setMessageType("success");
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
      if (editingRecordId === recordToDelete.id) {
        handleBackToMain();
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setRecordToDelete(null);
  };

  const handleEditRecord = (record) => {
    setEditingRecordId(record.id);
    setPeriodName(record.periodName);
    setDaysAttended(record.daysAttended);
    setExtraHolidays(record.extraHolidays || "");
    setAttendancePercentage(record.attendancePercentage);
    setShowAttendanceDisplayInButton(false);
    setMessage(null);
    setMessageType(null);
  };

  const handleBackToMain = () => {
    setEditingRecordId(null);
    setDaysAttended("");
    setExtraHolidays("");
    setAttendancePercentage(null);
    setShowAttendanceDisplayInButton(false);
    setMessage(null);
    setMessageType(null);

    const today = new Date();
    const currentMonth = today.toLocaleString("default", { month: "long" });
    const currentYear = today.getFullYear();
    setPeriodName(`${currentMonth} ${currentYear}`);
  };

  const dismissMessage = () => {
    setMessage(null);
    setMessageType(null);
  };

  const calculateYearlySummary = useCallback(() => {
    const years = [
      ...new Set(
        attendanceRecords.map((record) =>
          new Date(record.timestamp).getFullYear()
        )
      ),
    ].sort((a, b) => b - a);

    return years.map((year) => {
      const recordsInYear = attendanceRecords.filter(
        (record) => new Date(record.timestamp).getFullYear() === year
      );
      const totalWorkingDaysYear = recordsInYear.reduce(
        (sum, record) => sum + record.totalWorkingDays,
        0
      );
      const totalDaysAttendedYear = recordsInYear.reduce(
        (sum, record) => sum + record.daysAttended,
        0
      );
      const yearlyPercentage =
        totalWorkingDaysYear > 0
          ? ((totalDaysAttendedYear / totalWorkingDaysYear) * 100).toFixed(2)
          : "0.00";

      return {
        year,
        totalWorkingDays: totalWorkingDaysYear,
        totalDaysAttended: totalDaysAttendedYear,
        yearlyPercentage: yearlyPercentage,
      };
    });
  }, [attendanceRecords]);

  const yearlySummaries = calculateYearlySummary();

  if (isLoading) {
    return (
      <div className="app-container loading-state">
        <div className="loading-text">Loading attendance data...</div>
      </div>
    );
  }

  const primaryButtonText = editingRecordId
    ? "Update Record"
    : "Calculate Attendance";
  const primaryButtonOnClick = editingRecordId
    ? saveOrUpdateAttendance
    : calculateAttendance;

  return (
    <div className="app-container">
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          background-color: #0A0A1A;
          color: #f1f1f1;
        }
        .app-container {
          min-height: 100vh;
          background-color: #0A0A1A;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem 1rem;
          box-sizing: border-box;
        }
        .loading-state {
          justify-content: center;
        }
        .loading-text {
          font-size: 1.25rem;
          font-weight: 600;
          color: #d1d5db;
        }
        .main-card, .history-card, .yearly-summary-card {
          width: 100%;
          max-width: 28rem;
          background-color: #1A1A2E;
          padding: 1.5rem;
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          border: 1px solid #2C2C4A;
          position: relative;
          box-sizing: border-box;
        }
        @media (min-width: 768px) {
          .app-container {
            padding: 2.5rem;
          }
        }
        .back-button {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          padding: 0.5rem;
          border-radius: 9999px;
          background-color: #3A3A50;
          color: #e5e7eb;
          transition: all 0.3s ease-in-out;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          z-index: 10;
          overflow: hidden;
          width: 2.5rem;
        }
        .back-button:hover {
          background-color: #4A4A60;
          width: 6.5rem;
          padding: 0.5rem 0.75rem;
        }
        .back-button:hover span {
            opacity: 1;
            width: auto;
            margin-left: 0.25rem;
        }
        .back-button:focus {
          outline: none;
          box-shadow: 0 0 0 2px #6b7280;
        }
        .back-button svg {
            flex-shrink: 0;
            height: 1.25rem;
            width: 1.25rem;
        }
        .back-button span {
            opacity: 0;
            width: 0;
            overflow: hidden;
            white-space: nowrap;
            transition: opacity 0.2s ease-in-out, width 0.2s ease-in-out, margin-left 0.2s ease-in-out;
        }
        .app-title {
          font-size: 1.875rem;
          font-weight: 700;
          text-align: center;
          margin-top: 2.5rem;
          margin-bottom: 0.5rem;
          color: #DDA0DD;
          cursor: default;
          position: relative;
          z-index: 5;
        }
        .message-banner-container {
          overflow: hidden;
          transition: max-height 0.3s ease-out, opacity 0.3s ease-out, margin-bottom 0.3s ease-out;
          max-height: 0;
          opacity: 0;
          margin-bottom: 0;
        }
        .message-banner-container.visible {
          max-height: 100px;
          opacity: 1;
          margin-bottom: 1rem;
        }
        .message-banner {
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: background-color 200ms ease-in-out;
        }
        .message-banner.error {
          background-color: #7f1d1d;
          border: 1px solid #b91c1c;
          color: #fca5a5;
        }
        .message-banner.error:hover {
          background-color: #6d1d1d;
        }
        .message-banner.success {
          background-color: #065f46;
          border: 1px solid #059669;
          color: #a7f3d0;
        }
        .message-banner.success:hover {
          background-color: #064e3b;
        }
        .message-banner-text {
          display: block;
        }
        .message-close-btn {
          position: absolute;
          top: 0.25rem;
          right: 0.5rem;
          color: #9ca3af;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 9999px;
          opacity: 0;
          transition: opacity 0.2s ease-in-out;
          border: none;
          background: none;
        }
        .message-banner:hover .message-close-btn {
          opacity: 1;
        }
        .message-close-btn:hover {
          color: #e5e7eb;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #d1d5db;
          margin-bottom: 0.25rem;
        }
        .form-input {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #2C2C4A;
          border-radius: 0.375rem;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          outline: none;
          background-color: #25253B;
          color: #f1f1f1;
          box-sizing: border-box;
        }
        .form-input::placeholder {
          color: #9ca3af;
        }
        .form-input:focus {
          border-color: #A855F7;
          box-shadow: 0 0 0 1px #A855F7;
        }
        .form-input.read-only {
          cursor: not-allowed;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        .flex-row {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .flex-row > div {
          flex: 1;
        }
        .primary-button {
          width: 100%;
          height: 56px;
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          transition: background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out, height 0.4s ease-in-out, border-color 0.4s ease-in-out;
          border: none;
          font-size: 1.125rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          box-sizing: border-box;
          margin-bottom: 1rem;
        }
        .primary-button.disabled {
          background-color: #4b5563;
          color: #d1d5db;
          cursor: not-allowed;
          opacity: 0.6;
          box-shadow: none;
        }
        .primary-button:not(.disabled) {
            background-color: #8b5cf6;
        }
        .primary-button:hover:not(.disabled) {
            background-color: #7c3aed;
        }
        .primary-button:focus:not(.disabled) {
            outline: none;
            box-shadow: 0 0 0 2px #a855f7, 0 0 0 4px rgba(168, 85, 247, 0.5);
        }
        .morphed-button-display {
          height: 64px;
          background-color: #4C0879;
          border: 1px solid #7E22CE;
          font-size: 1.125rem;
          font-weight: 600;
          color: #c084fc;
          padding: 0.75rem 1rem;
        }
        .morphed-button-display .attendance-percentage-display {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }
        .morphed-button-display .attendance-percentage-value {
            color: #d8b4fe;
            font-weight: 700;
            margin-left: 0.25rem;
        }
        .save-button {
          margin-top: 1rem;
          background-color: #8b5cf6;
        }
        .save-button:hover:not(.disabled) {
          background-color: #7c3aed;
        }
        .save-button:focus:not(.disabled) {
          outline: none;
          box-shadow: 0 0 0 2px #a855f7, 0 0 0 4px rgba(168, 85, 247, 0.5);
        }
        .history-card {
          width: 100%;
          max-width: 28rem;
          background-color: #1A1A2E;
          padding: 1.5rem;
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          border: 1px solid #2C2C4A;
          box-sizing: border-box;
        }
        .history-title {
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 1.5rem;
          color: #DDA0DD;
        }
        .no-records-text {
          text-align: center;
          color: #9ca3af;
        }
        .record-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .record-item {
          padding: 1rem;
          border: 1px solid #2C2C4A;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: #20203A;
          transition: background-color 150ms ease-in-out;
          cursor: pointer;
          position: relative;
        }
        .record-item:hover {
          background-color: #2C2C4A;
        }
        .record-details p {
          margin: 0;
        }
        .record-period {
          font-size: 1.125rem;
          font-weight: 600;
          color: #f1f1f1;
          display: flex;
          align-items: center;
        }
        .current-pill {
            background-color: #32CD32;
            color: #fff;
            font-size: 0.625rem;
            font-weight: 700;
            padding: 0.125rem 0.5rem;
            border-radius: 9999px;
            margin-left: 0.5rem;
            text-transform: uppercase;
        }
        .record-days {
          font-size: 0.875rem;
          color: #9ca3af;
        }
        .record-percentage {
          font-size: 1rem;
          font-weight: 500;
          color: #DDA0DD;
        }
        .record-extra-holidays {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        .record-timestamp {
          font-size: 0.75rem;
          color: #9ca3af;
        }
        .delete-button {
          margin-left: 1rem;
          padding: 0.5rem;
          border-radius: 9999px;
          background-color: #B22222;
          color: #FFDAB9;
          transition: background-color 150ms ease-in-out;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .delete-button:hover:not(.disabled) {
          background-color: #8B0000;
        }
        .delete-button.disabled {
          background-color: #4b5563;
          color: #9ca3af;
          cursor: not-allowed;
          opacity: 0.5;
        }
        .delete-button svg {
          height: 1.25rem;
          width: 1.25rem;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(31, 41, 55, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }
        .modal-content {
          background-color: #1A1A2E;
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 24rem;
          border: 1px solid #2C2C4A;
          box-sizing: border-box;
        }
        .modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: #f1f1f1;
        }
        .modal-message {
          margin-bottom: 1.5rem;
          color: #d1d5db;
        }
        .modal-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
        .modal-button {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          transition: background-color 150ms ease-in-out;
          border: none;
          cursor: pointer;
        }
        .modal-cancel-button {
          border: 1px solid #4b5563;
          background-color: transparent;
          color: #d1d5db;
        }
        .modal-cancel-button:hover {
          background-color: #374151;
        }
        .modal-delete-button {
          background-color: #B22222;
          color: #fff;
        }
        .modal-delete-button:hover {
          background-color: #8B0000;
        }
        .footer {
            margin-top: 2rem;
            color: #9ca3af;
            font-size: 0.875rem;
            text-align: center;
        }
        .yearly-summary-card {
            margin-bottom: 2rem;
            max-height: 50px;
            overflow: hidden;
            transition: max-height 0.7s ease-in-out, opacity 0.7s ease-in-out, transform 0.7s ease-in-out;
            opacity: 0.2;
            transform: translateY(20px) scale(0.95);
            cursor: pointer;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            padding: 1.5rem;
            box-sizing: border-box;
        }
        .yearly-summary-card:hover {
            max-height: 500px;
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .yearly-summary-title {
            font-size: 1.5rem;
            font-weight: 700;
            text-align: center;
            margin-bottom: 0;
            color: #DDA0DD;
            position: relative;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .yearly-summary-content {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
            padding-top: 0.5rem;
            color: #f1f1f1;
        }
        .yearly-summary-card:not(:hover) .yearly-summary-content {
            visibility: hidden;
            opacity: 0;
            height: 0;
            padding-top: 0;
            transition: visibility 0s 0.7s, opacity 0.7s ease-in-out, height 0.7s ease-in-out, padding-top 0.7s ease-in-out;
        }
        .yearly-summary-card:hover .yearly-summary-content {
            visibility: visible;
            opacity: 1;
            height: auto;
            transition: visibility 0s, opacity 0.7s ease-in-out, height 0.7s ease-in-out, padding-top 0.7s ease-in-out;
        }
        .yearly-summary-card .collapsed-text-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #DDA0DD;
            font-size: 1.25rem;
            font-weight: 600;
            opacity: 1;
            transition: opacity 0.3s ease-in-out;
            pointer-events: none;
            white-space: nowrap;
        }
        .yearly-summary-card:hover .collapsed-text-overlay {
            opacity: 0;
        }
        .yearly-summary-line {
            padding: 0.5rem 0.75rem;
            border: 1px solid #2C2C4A;
            border-radius: 0.5rem;
            background-color: #20203A;
            margin-bottom: 0.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.95rem;
            color: #d1d5db;
        }
        .yearly-summary-line:last-child {
            border-bottom: 1px solid #2C2C4A;
            font-weight: 600;
            font-size: 1.1rem;
            color: #DDA0DD;
            margin-bottom: 0;
        }
        .yearly-summary-line span:first-child {
            color: #9ca3af;
        }
        .yearly-summary-line .yearly-summary-value {
            color: #f1f1f1;
            font-weight: 500;
        }
        .yearly-summary-line:last-child .yearly-summary-value {
            color: #E6E6FA;
            font-weight: 700;
        }
        `}
      </style>

      <div className="main-card">
        {editingRecordId && (
          <button
            onClick={handleBackToMain}
            className="back-button"
            title="Back to New Record"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back</span>
          </button>
        )}
        <h1 className="app-title">Attendance Calculator</h1>
        <div className={`message-banner-container ${message ? "visible" : ""}`}>
          {message && (
            <div
              className={`message-banner ${
                messageType === "error" ? "error" : "success"
              }`}
              role="alert"
              onClick={dismissMessage}
            >
              <span className="message-banner-text">{message}</span>
              <button className="message-close-btn" title="Dismiss">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="periodName" className="form-label">
            Period Name (e.g., March 2025)
          </label>
          <input
            type="text"
            id="periodName"
            className="form-input"
            value={periodName}
            onChange={(e) => {
              setPeriodName(e.target.value);
              setShowAttendanceDisplayInButton(false);
              setAttendancePercentage(null);
            }}
            placeholder="e.g., March 2025"
          />
        </div>
        <div className="form-group flex-row">
          <div className="flex-item">
            <label htmlFor="totalWorkingDays" className="form-label">
              Total Working Days
            </label>
            <input
              type="number"
              id="totalWorkingDays"
              className="form-input read-only"
              value={totalWorkingDays}
              readOnly
            />
          </div>
          <div className="flex-item">
            <label htmlFor="extraHolidays" className="form-label">
              Extra Holidays
            </label>
            <input
              type="number"
              id="extraHolidays"
              className="form-input"
              value={extraHolidays}
              onChange={(e) => {
                const val = e.target.value;
                setExtraHolidays(val === "" ? "" : Math.max(0, parseInt(val)));
                setShowAttendanceDisplayInButton(false);
                setAttendancePercentage(null);
              }}
              placeholder="e.g., 2"
              min="0"
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="daysAttended" className="form-label">
            Days Attended
          </label>
          <input
            type="number"
            id="daysAttended"
            className="form-input"
            value={daysAttended}
            onChange={(e) => {
              setDaysAttended(e.target.value);
              setShowAttendanceDisplayInButton(false);
              setAttendancePercentage(null);
            }}
            placeholder="e.g., 18"
            min="0"
          />
        </div>
        <button
          onClick={primaryButtonOnClick}
          disabled={
            !periodName.trim() ||
            totalWorkingDays <= 0 ||
            daysAttended === "" ||
            isNaN(parseFloat(daysAttended))
          }
          className={`primary-button btn-shadow ${
            showAttendanceDisplayInButton && attendancePercentage !== null
              ? "morphed-button-display"
              : "morphed-button"
          } ${
            !periodName.trim() ||
            totalWorkingDays <= 0 ||
            daysAttended === "" ||
            isNaN(parseFloat(daysAttended))
              ? "disabled"
              : ""
          }`}
        >
          {showAttendanceDisplayInButton && attendancePercentage !== null ? (
            <p className="attendance-percentage-display">
              Your Attendance:{" "}
              <span className="attendance-percentage-value">
                {attendancePercentage}%
              </span>
            </p>
          ) : (
            primaryButtonText
          )}
        </button>
        {!editingRecordId && (
          <button
            onClick={saveOrUpdateAttendance}
            disabled={
              !periodName.trim() ||
              totalWorkingDays <= 0 ||
              daysAttended === "" ||
              isNaN(parseFloat(daysAttended)) ||
              attendancePercentage === null
            }
            className={`primary-button btn-shadow save-button ${
              !periodName.trim() ||
              totalWorkingDays <= 0 ||
              daysAttended === "" ||
              isNaN(parseFloat(daysAttended)) ||
              attendancePercentage === null
                ? "disabled"
                : ""
            }`}
          >
            Save Attendance Record
          </button>
        )}
      </div>
      <div className="history-card">
        <h2 className="history-title">Saved Attendance Records</h2>
        {attendanceRecords.length === 0 ? (
          <p className="no-records-text">No records saved yet.</p>
        ) : (
          <ul className="record-list">
            {attendanceRecords.map((record) => (
              <li
                key={record.id}
                className="record-item"
                onClick={() => {
                  if (editingRecordId !== record.id) handleEditRecord(record);
                }}
              >
                <div className="record-details">
                  <p className="record-period">
                    {record.periodName}
                    {editingRecordId === record.id && (
                      <span className="current-pill">Current</span>
                    )}
                  </p>
                  <p className="record-days">
                    Days: {record.daysAttended} / {record.totalWorkingDays}
                  </p>
                  <p className="record-percentage">
                    Attendance: {record.attendancePercentage}%
                  </p>
                  {record.extraHolidays > 0 && (
                    <p className="record-extra-holidays">
                      Extra Holidays: {record.extraHolidays}
                    </p>
                  )}
                  {record.timestamp && (
                    <p className="record-timestamp">
                      Saved: {new Date(record.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteClick(e, record)}
                  className={`delete-button ${
                    editingRecordId === record.id ? "disabled" : ""
                  }`}
                  aria-label="Delete record"
                  disabled={editingRecordId === record.id}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {yearlySummaries.length > 0 && (
        <div className="yearly-summary-card">
          <h2 className="yearly-summary-title">Yearly Overview</h2>
          <div className="yearly-summary-content">
            {yearlySummaries.map((summary) => (
              <div key={summary.year}>
                <div className="yearly-summary-line">
                  <span>Year:</span>
                  <span className="yearly-summary-value">{summary.year}</span>
                </div>
                <div className="yearly-summary-line">
                  <span>Total Working Days:</span>
                  <span className="yearly-summary-value">
                    {summary.totalWorkingDays}
                  </span>
                </div>
                <div className="yearly-summary-line">
                  <span>Total Days Attended:</span>
                  <span className="yearly-summary-value">
                    {summary.totalDaysAttended}
                  </span>
                </div>
                <div className="yearly-summary-line">
                  <span>Overall Percentage:</span>
                  <span className="yearly-summary-value">
                    {summary.yearlyPercentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <footer className="footer">Made with ❤️ by Divyansh</footer>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirm Delete</h3>
            <p className="modal-message">
              Are you sure you want to delete the attendance record for{" "}
              <strong>{recordToDelete?.periodName}</strong>?
            </p>
            <p className="modal-message">
              Days: {recordToDelete?.daysAttended} /{" "}
              {recordToDelete?.totalWorkingDays}(
              {recordToDelete?.attendancePercentage}%)
            </p>
            <div className="modal-buttons">
              <button
                onClick={cancelDelete}
                className="modal-button modal-cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="modal-button modal-delete-button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
