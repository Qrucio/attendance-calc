import React, { useState, useEffect, useCallback } from 'react';

// Helper function to parse periodName (e.g., "March 2025") into a Date object for sorting
// This allows for consistent sorting based on the month and year.
const parsePeriodNameToSortableDate = (periodName) => {
  const parts = periodName.split(' ');
  // If the format is not as expected, return a very old date to push it to the end
  if (parts.length < 2) return new Date(0); 

  const monthString = parts[0];
  const yearString = parts[1];

  // Map full and abbreviated month names to their 0-indexed month numbers
  const monthMap = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
  };

  const monthIndex = monthMap[monthString.toLowerCase()];
  const year = parseInt(yearString);

  // If month or year cannot be parsed, return a very old date
  if (monthIndex === undefined || isNaN(year)) {
    return new Date(0); 
  }

  // Create a Date object representing the first day of that month and year
  return new Date(year, monthIndex, 1); 
};

// Helper function to calculate working days for a given month and year
const calculateMonthlyWorkingDays = (month, year, extraHolidaysCount = 0) => {
  const date = new Date(year, month - 1, 1); // Month is 0-indexed in JS Date constructor
  const totalDaysInMonth = new Date(year, month, 0).getDate(); // Last day of the month

  let nonWorkingDays = 0;
  let secondSaturdayFound = false;
  let saturdayCount = 0;

  for (let i = 1; i <= totalDaysInMonth; i++) {
    date.setDate(i);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek === 0) { // Sunday
      nonWorkingDays++;
    } else if (dayOfWeek === 6) { // Saturday
      saturdayCount++;
      if (saturdayCount === 2 && !secondSaturdayFound) { // Check for the second Saturday
        nonWorkingDays++;
        secondSaturdayFound = true; // Ensure it's counted only once
      }
    }
  }

  // Calculate total working days by subtracting Sundays, the second Saturday, and extra holidays
  const totalCalculatedWorkingDays = totalDaysInMonth - nonWorkingDays - extraHolidaysCount;
  return totalCalculatedWorkingDays > 0 ? totalCalculatedWorkingDays : 0;
};

// Main App Component
const App = () => {
  const [periodName, setPeriodName] = useState('');
  const [totalWorkingDays, setTotalWorkingDays] = useState(0); // Automatically calculated
  const [daysAttended, setDaysAttended] = useState('');
  const [extraHolidays, setExtraHolidays] = useState(''); // State for extra holidays
  const [attendancePercentage, setAttendancePercentage] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Still useful for initial local storage load
  const [message, setMessage] = useState(null); // Unified message state
  const [messageType, setMessageType] = useState(null); // 'success' or 'error'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null); // State for the record being edited
  const [showAttendanceDisplayInButton, setShowAttendanceDisplayInButton] = useState(false); // New state for button morphing
  const [showPlusOneTick, setShowPlusOneTick] = useState(false); // State for +1 button tick animation
  const [isPlusOneFlashing, setIsPlusOneFlashing] = useState(false); // New state for green flash

  // Initialize with current month/year and load records from localStorage on component mount
  useEffect(() => {
    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long' });
    const currentYear = today.getFullYear();
    setPeriodName(`${currentMonth} ${currentYear}`);

    try {
      const storedRecords = localStorage.getItem('attendanceRecords');
      if (storedRecords) {
        const parsedRecords = JSON.parse(storedRecords);
        // Sort records by periodName (latest month comes on top)
        const sortedRecords = parsedRecords.sort((a, b) => {
          const dateA = parsePeriodNameToSortableDate(a.periodName);
          const dateB = parsePeriodNameToSortableDate(b.periodName);
          // Sort in descending order (latest month first)
          return dateB.getTime() - dateA.getTime(); 
        });
        setAttendanceRecords(sortedRecords);

        // Automatically open the latest saved record if it exists
        if (sortedRecords.length > 0) {
          const lastRecord = sortedRecords[0]; 
          handleEditRecord(lastRecord);
        }
      }
    } catch (e) {
      console.error("Failed to load records from local storage:", e);
      setMessage("Failed to load records from your browser's cache. They might be corrupted.");
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to automatically calculate total working days based on periodName and extraHolidays
  useEffect(() => {
    const parsePeriodName = (name) => {
      const currentYear = new Date().getFullYear();
      let month = null;
      let year = currentYear;

      // Regular expression to match month names (full or short) and optional year
      const match = name.toLowerCase().match(/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{4})?$/);

      if (match) {
        const monthString = match[1];
        const yearString = match[2];

        const monthNames = [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december"
        ];
        const shortMonthNames = [
          "jan", "feb", "mar", "apr", "may", "jun",
          "jul", "aug", "sep", "oct", "nov", "dec"
        ];

        month = monthNames.indexOf(monthString) + 1;
        if (month === 0) { // Not found in full names, try short names
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

    if (parsed.month > 0 && parsed.month <= 12 && parsed.year >= 1900 && parsed.year <= 2100) { // Basic year range validation
      const calculatedDays = calculateMonthlyWorkingDays(parsed.month, parsed.year, numExtraHolidays);
      setTotalWorkingDays(calculatedDays);
    } else {
      setTotalWorkingDays(0); // Reset if periodName is invalid or incomplete
    }
  }, [periodName, extraHolidays]);


  // Function to calculate attendance
  const calculateAttendance = useCallback(() => {
    const total = parseFloat(totalWorkingDays);
    const attended = parseFloat(daysAttended);

    // Validate inputs before calculation
    if (total <= 0) {
      setMessage("Total working days must be greater than zero. Please ensure the period name is valid and there are no excessive extra holidays.");
      setMessageType('error');
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false); // Revert button if error
      return;
    }

    if (isNaN(attended) || attended < 0) {
      setMessage("Please enter a non-negative number for days attended.");
      setMessageType('error');
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false); // Revert button if error
      return;
    }

    if (attended > total) {
      setMessage("Days attended cannot exceed total working days.");
      setMessageType('error');
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false); // Revert button if error
      return;
    }

    const percentage = (attended / total) * 100;
    setAttendancePercentage(percentage.toFixed(2));
    setMessage(null); // Clear previous messages on successful calculation
    setMessageType(null);
    setShowAttendanceDisplayInButton(true); // Morph button to display percentage
  }, [totalWorkingDays, daysAttended]); // Recalculate if these dependencies change

  // Function to save or update attendance record to Local Storage
  const saveOrUpdateAttendance = async () => {
    // Always recalculate attendance before saving/updating
    const total = parseFloat(totalWorkingDays);
    const attended = parseFloat(daysAttended);

    if (total <= 0 || isNaN(attended) || attended < 0 || attended > total || !periodName.trim()) {
      setMessage("Please ensure all fields are correctly filled before saving/updating.");
      setMessageType('error');
      setShowAttendanceDisplayInButton(false);
      setAttendancePercentage(null); // Clear percentage if inputs are invalid
      return;
    }

    const percentage = (attended / total) * 100;
    setAttendancePercentage(percentage.toFixed(2)); // Update state with new percentage
    setShowAttendanceDisplayInButton(true); // Ensure button morphs to display percentage

    const recordData = {
      periodName: periodName.trim(),
      totalWorkingDays: total,
      daysAttended: attended,
      extraHolidays: parseInt(extraHolidays) || 0,
      attendancePercentage: parseFloat(percentage.toFixed(2)),
      timestamp: new Date().toISOString(), // Use ISO string for local storage timestamp
      id: editingRecordId || crypto.randomUUID() // Generate ID if new record, otherwise use existing
    };

    let updatedRecords;
    if (editingRecordId) {
      // Update existing record and re-sort the entire list
      updatedRecords = attendanceRecords.map(rec =>
        rec.id === editingRecordId ? recordData : rec
      ).sort((a, b) => {
        const dateA = parsePeriodNameToSortableDate(a.periodName);
        const dateB = parsePeriodNameToSortableDate(b.periodName);
        return dateB.getTime() - dateA.getTime(); // Descending order (latest first)
      });
      setMessage("Record updated successfully!");
      setMessageType('success');
    } else {
      // Add new record and re-sort the entire list
      updatedRecords = [recordData, ...attendanceRecords].sort((a, b) => {
        const dateA = parsePeriodNameToSortableDate(a.periodName);
        const dateB = parsePeriodNameToSortableDate(b.periodName);
        return dateB.getTime() - dateA.getTime(); // Descending order (latest first)
      });
      setMessage("Record saved successfully!");
      setMessageType('success');
      // For new records, clear the form for the next entry
      setPeriodName('');
      setDaysAttended('');
      setExtraHolidays('');
      setAttendancePercentage(null);
      setShowAttendanceDisplayInButton(false); 
      // Reset period name to current month/year after saving a new record
      const today = new Date();
      const currentMonth = today.toLocaleString('default', { month: 'long' });
      const currentYear = today.getFullYear();
      setPeriodName(`${currentMonth} ${currentYear}`);
    }

    setAttendanceRecords(updatedRecords);
    localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords)); // Save to local storage
  };

  // Function to prompt for delete confirmation
  const handleDeleteClick = (e, record) => { // Added 'e' to access event object
    e.stopPropagation(); // Prevent record item click from triggering
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };

  // Function to confirm and delete record
  const confirmDelete = () => {
    if (recordToDelete) {
      // Filter out the deleted record and re-sort the remaining list
      const updatedRecords = attendanceRecords.filter(rec => rec.id !== recordToDelete.id)
        .sort((a, b) => {
          const dateA = parsePeriodNameToSortableDate(a.periodName);
          const dateB = parsePeriodNameToSortableDate(b.periodName);
          return dateB.getTime() - dateA.getTime(); // Descending order (latest first)
        });
      setAttendanceRecords(updatedRecords);
      localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords));
      setMessage("Record deleted successfully!");
      setMessageType('success');
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
      // If the deleted record was the one being edited, go back to new record mode
      if (editingRecordId === recordToDelete.id) {
        handleBackToMain();
      }
    }
  };

  // Function to cancel delete operation
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setRecordToDelete(null);
  };

  // Function to load record for editing
  const handleEditRecord = (record) => {
    setEditingRecordId(record.id);
    setPeriodName(record.periodName);
    setDaysAttended(record.daysAttended);
    setExtraHolidays(record.extraHolidays || '');
    setAttendancePercentage(record.attendancePercentage);
    setShowAttendanceDisplayInButton(false); // Start NOT morphed when editing, it will morph on save/update
    setMessage(null); // Clear any previous messages when loading a record
    setMessageType(null);
  };

  // Function to return to main page (new record mode)
  const handleBackToMain = () => {
    setEditingRecordId(null);
    setDaysAttended('');
    setExtraHolidays('');
    setAttendancePercentage(null);
    setShowAttendanceDisplayInButton(false); // Revert button to "Calculate"
    setMessage(null); // Clear messages when navigating back
    setMessageType(null);

    // Reset period name to current month/year
    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long' });
    const currentYear = today.getFullYear();
    setPeriodName(`${currentMonth} ${currentYear}`);
  };

  // Function to dismiss a message banner
  const dismissMessage = () => {
    setMessage(null);
    setMessageType(null);
  };

  // Function to handle +1 attendance click
  const handlePlusOne = async () => {
    const currentDaysAttended = parseFloat(daysAttended) || 0;
    const newDaysAttended = currentDaysAttended + 1;

    // Prevent exceeding total working days
    if (newDaysAttended > totalWorkingDays) {
      setMessage("Cannot add attendance: Days attended would exceed total working days.");
      setMessageType('error');
      return;
    }

    setDaysAttended(newDaysAttended);
    setShowAttendanceDisplayInButton(false); // Reset button state
    setAttendancePercentage(null); // Clear percentage until re-calculated/saved

    setShowPlusOneTick(true); // Show tick animation
    setIsPlusOneFlashing(true); // Start green flash
    
    setTimeout(() => {
      setShowPlusOneTick(false); // Hide tick after animation
      setIsPlusOneFlashing(false); // Stop green flash
    }, 1000); // Match this with CSS animation duration

    // Automatically save/update the record after incrementing
    // We need to pass the updated value to saveOrUpdateAttendance
    // A more robust way would be to update local state first, then call save.
    // Let's create a temporary record object for saveOrUpdateAttendance
    const tempRecordData = {
      periodName: periodName.trim(),
      totalWorkingDays: totalWorkingDays,
      daysAttended: newDaysAttended, // Use the incremented value
      extraHolidays: parseInt(extraHolidays) || 0,
      // attendancePercentage will be recalculated inside saveOrUpdateAttendance
      timestamp: new Date().toISOString(),
      id: editingRecordId || crypto.randomUUID()
    };

    // Manually trigger the save/update logic with the new data
    const total = parseFloat(tempRecordData.totalWorkingDays);
    const attended = parseFloat(tempRecordData.daysAttended);

    if (total <= 0 || isNaN(attended) || attended < 0 || attended > total || !tempRecordData.periodName.trim()) {
      setMessage("Invalid data for auto-save. Please check inputs.");
      setMessageType('error');
      return;
    }

    const percentage = (attended / total) * 100;
    tempRecordData.attendancePercentage = parseFloat(percentage.toFixed(2));

    let updatedRecords;
    if (editingRecordId) {
      updatedRecords = attendanceRecords.map(rec =>
        rec.id === editingRecordId ? tempRecordData : rec
      ).sort((a, b) => {
        const dateA = parsePeriodNameToSortableDate(a.periodName);
        const dateB = parsePeriodNameToSortableDate(b.periodName);
        return dateB.getTime() - dateA.getTime(); // Descending order (latest first)
      });
      setMessage("Attendance updated successfully!");
      setMessageType('success');
    } else {
      updatedRecords = [tempRecordData, ...attendanceRecords].sort((a, b) => {
        const dateA = parsePeriodNameToSortableDate(a.periodName);
        const dateB = parsePeriodNameToSortableDate(b.periodName);
        return dateB.getTime() - dateA.getTime(); // Descending order (latest first)
      });
      setMessage("Attendance saved successfully!");
      setMessageType('success');
      // For new records, we might want to keep the current period name for subsequent +1 clicks
      // setPeriodName(''); // Don't clear periodName here for +1
      // setDaysAttended(''); // Don't clear daysAttended here for +1
      // setExtraHolidays(''); // Don't clear extraHolidays here for +1
      // setAttendancePercentage(null); // Handled by saveOrUpdate
      // setShowAttendanceDisplayInButton(false); // Handled by saveOrUpdate
    }

    setAttendanceRecords(updatedRecords);
    localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords));
  };


  // Calculate yearly attendance summary
  const calculateYearlySummary = useCallback(() => {
    const years = [...new Set(attendanceRecords.map(record => new Date(record.timestamp).getFullYear()))].sort((a, b) => b - a);
    
    return years.map(year => {
      const recordsInYear = attendanceRecords.filter(record => new Date(record.timestamp).getFullYear() === year);
      const totalWorkingDaysYear = recordsInYear.reduce((sum, record) => sum + record.totalWorkingDays, 0);
      const totalDaysAttendedYear = recordsInYear.reduce((sum, record) => sum + record.daysAttended, 0);
      const yearlyPercentage = totalWorkingDaysYear > 0 ? ((totalDaysAttendedYear / totalWorkingDaysYear) * 100).toFixed(2) : '0.00';

      return {
        year,
        totalWorkingDays: totalWorkingDaysYear,
        totalDaysAttended: totalDaysAttendedYear,
        yearlyPercentage: yearlyPercentage
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

  // Determine the primary action button's text and onClick handler
  const primaryButtonText = editingRecordId ? 'Update Record' : 'Calculate Attendance';
  const primaryButtonOnClick = editingRecordId ? saveOrUpdateAttendance : calculateAttendance;

  return (
    <div className="app-container">
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          background-color: #0A0A1A; /* Darker background */
          color: #f1f1f1; /* Light gray text for dark theme */
        }

        .app-container {
          min-height: 100vh;
          background-color: #0A0A1A; /* Darker background */
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

        .main-card, .history-card, .yearly-summary-card { /* Added yearly-summary-card */
          width: 100%;
          max-width: 28rem;
          background-color: #1A1A2E; /* Darker card background */
          padding: 1.5rem;
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1); /* Slightly stronger shadow for darker theme */
          margin-bottom: 2rem;
          border: 1px solid #2C2C4A; /* Darker border */
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
          padding: 0.5rem; /* Initial padding for icon-only state */
          border-radius: 9999px;
          background-color: #3A3A50; /* Darker grey for button */
          color: #e5e7eb;
          transition: all 0.3s ease-in-out; /* Smoother transition */
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem; /* text-sm */
          z-index: 10;
          overflow: hidden;
          width: 2.5rem; /* Initial width (e.g., for 40px square) */
        }

        .back-button:hover {
          background-color: #4A4A60; /* Darker hover */
          width: 6.5rem; /* Expanded width to show "Back" text */
          padding: 0.5rem 0.75rem; /* Expanded padding */
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
          margin-top: 2.5rem; /* Increased margin to push it down */
          margin-bottom: 0.5rem;
          color: #DDA0DD; /* A more aesthetic purple, like Plum */
          cursor: default;
          position: relative;
          z-index: 5;
        }

        .message-banner-container {
          overflow: hidden;
          transition: max-height 0.3s ease-out, opacity 0.3s ease-out, margin-bottom 0.3s ease-out; /* Smoother transition */
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
          border: 1px solid #2C2C4A; /* Darker input border */
          border-radius: 0.375rem;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          outline: none;
          background-color: #25253B; /* Darker input background */
          color: #f1f1f1;
          box-sizing: border-box;
        }

        .form-input::placeholder {
          color: #9ca3af;
        }

        .form-input:focus {
          border-color: #A855F7; /* Purple-500 */
          box-shadow: 0 0 0 1px #A855F7;
        }

        .form-input.read-only {
          cursor: not-allowed;
        }

        /* Hide number input spin buttons */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield; /* Firefox */
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
          height: 56px; /* Consistent height for both states */
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          transition: background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out, height 0.4s ease-in-out, border-color 0.4s ease-in-out; /* Removed transform for smoother morphing */
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
            background-color: #8b5cf6; /* Reverted to previous purple-600 */
        }
        .primary-button:hover:not(.disabled) {
            background-color: #7c3aed; /* Reverted to previous purple-700 */
        }
        .primary-button:focus:not(.disabled) {
            outline: none;
            box-shadow: 0 0 0 2px #a855f7, 0 0 0 4px rgba(168, 85, 247, 0.5);
        }

        .morphed-button-display {
          height: 64px; /* Slightly taller when morphed */
          background-color: #4C0879; /* Reverted to previous darker purple for display */
          border: 1px solid #7E22CE; /* Reverted to previous purple 700 */
          font-size: 1.125rem;
          font-weight: 600;
          color: #c084fc; /* Reverted to previous purple-200 */
          padding: 0.75rem 1rem;
          /* Removed transform: scale(1.02); */
        }
        .morphed-button-display .attendance-percentage-display {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }
        .morphed-button-display .attendance-percentage-value {
            color: #d8b4fe; /* Reverted to previous purple-300 */
            font-weight: 700;
            margin-left: 0.25rem;
        }

        .save-button {
          margin-top: 1rem;
          background-color: #8b5cf6; /* Reverted to previous purple-600 */
        }
        .save-button:hover:not(.disabled) {
          background-color: #7c3aed; /* Reverted to previous purple-700 */
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

        /* Yearly Summary Specific Styles */
        .yearly-summary-card {
            margin-bottom: 2rem;
            max-height: 50px; /* Collapsed height */
            overflow: hidden;
            transition: max-height 0.7s ease-in-out, opacity 0.7s ease-in-out, transform 0.7s ease-in-out; /* Dramatic animation */
            opacity: 0.2; /* Slightly faded when collapsed */
            transform: translateY(20px) scale(0.95); /* Initial dramatic state */
            cursor: pointer; /* Indicate it's interactive */
            display: flex;
            flex-direction: column;
            justify-content: flex-start; /* Align content to top when collapsed */
            align-items: center;
            padding: 1.5rem;
            box-sizing: border-box;
        }

        .yearly-summary-card:hover { /* Apply hover effect for all devices */
            max-height: 500px; /* Expanded height */
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        .yearly-summary-title {
            font-size: 1.5rem;
            font-weight: 700;
            text-align: center;
            margin-bottom: 0; /* No bottom margin for title in collapsed state */
            color: #DDA0DD;
            position: relative;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        /* Removed .yearly-summary-title svg styles */

        .yearly-summary-content {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
            padding-top: 0.5rem; /* Space between title and content when expanded */
            color: #f1f1f1; /* Ensure text color is light */
        }
        /* Hide content for collapsed state */
        .yearly-summary-card:not(:hover) .yearly-summary-content { /* Hide content when not hovered */
            visibility: hidden;
            opacity: 0;
            height: 0;
            padding-top: 0;
            transition: visibility 0s 0.7s, opacity 0.7s ease-in-out, height 0.7s ease-in-out, padding-top 0.7s ease-in-out;
        }
        .yearly-summary-card:hover .yearly-summary-content { /* Show content on hover */
            visibility: visible;
            opacity: 1;
            height: auto;
            transition: visibility 0s, opacity 0.7s ease-in-out, height 0.7s ease-in-out, padding-top 0.7s ease-in-out;
        }

        /* Collapsed state text overlay - this is the "double text" */
        .yearly-summary-card .collapsed-text-overlay {
            /* We will hide this completely */
            display: none;
        }
        
        /* Styles for individual summary lines to match record items */
        .yearly-summary-line-group { /* Added this class to group lines for better spacing */
            margin-bottom: 1rem; /* Space between each year's summary group */
            padding: 1rem; /* Padding for the group */
            border: 1px solid #2C2C4A; /* Border for the group */
            border-radius: 0.5rem; /* Rounded corners for the group */
            background-color: #20203A; /* Background for the group */
        }
        .yearly-summary-line {
            padding: 0.25rem 0; /* Reduced vertical padding for individual lines */
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.95rem; /* Consistent font size */
            color: #d1d5db; /* Default text color */
        }

        .yearly-summary-line:last-child {
            /* No specific border-bottom for last child within the group, as group has border */
            font-weight: 600;
            font-size: 1.1rem; /* Slightly larger for overall percentage */
            color: #DDA0DD; /* Plum for overall percentage */
            margin-bottom: 0; /* No bottom margin for the very last line within its group */
        }
        .yearly-summary-line span:first-child {
            color: #9ca3af; /* Label color */
        }
        .yearly-summary-line .yearly-summary-value {
            color: #f1f1f1; /* Value color */
            font-weight: 500;
        }
        .yearly-summary-line:last-child .yearly-summary-value {
            color: #E6E6FA; /* Lavender for final percentage value */
            font-weight: 700;
        }

        /* Styles for the +1 button */
        .plus-one-container {
            position: relative;
            /* Calculate height based on form-input padding and font-size */
            /* form-input height: 0.5rem (padding-top) + 0.5rem (padding-bottom) + 1rem (font-size, default) + 1px (border-top) + 1px (border-bottom) = 2rem + 2px = 32px + 2px = 34px */
            height: 34px; 
            width: 34px; /* Keep it square, same as height */
            /* Removed margin-left as it will be repositioned */
            flex-shrink: 0; /* Prevent it from shrinking */
        }

        .plus-one-button {
            width: 100%;
            height: 100%;
            background-color: #8b5cf6; /* Default purple color */
            color: #fff;
            border: none;
            border-radius: 50%; /* Circular */
            font-size: 1.25rem; /* Adjusted font size for more inner padding */
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease-in-out, transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            position: relative; /* Changed to relative to contain internal spans */
            overflow: hidden; /* Hide overflow during animation */
        }

        .plus-one-button.flashing { /* New class for green flash */
            background-color: #32CD32; /* LimeGreen */
        }

        .plus-one-button:hover:not(:disabled):not(.flashing) { /* Hover for default state */
            background-color: #7c3aed; /* Darker purple on hover */
            transform: translateY(-2px);
        }

        .plus-one-button:active:not(:disabled):not(.flashing) {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .plus-one-button:disabled {
            background-color: #4b5563;
            cursor: not-allowed;
            opacity: 0.6;
        }

        /* Styles for the morphing text/icon */
        .plus-one-button .plus-one-text,
        .plus-one-button .plus-one-icon {
            position: absolute;
            transition: all 0.3s ease-in-out; /* Smooth transition for morphing */
            font-size: 1.25rem; /* Consistent with button font size */
            font-weight: 700;
            color: #fff;
        }

        .plus-one-button .plus-one-text.hide {
            opacity: 0;
            transform: scale(0.5) translateY(-10px);
        }

        .plus-one-button .plus-one-icon {
            opacity: 0;
            transform: scale(0.5) translateY(10px);
        }

        .plus-one-button .plus-one-icon.show {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
        .days-attended-group {
            display: flex;
            align-items: center; /* Align input and button at the center */
            gap: 0.5rem;
        }
        .days-attended-input-wrapper {
            flex-grow: 1; /* Allow input to take available space */
        }

        /* New styles for the button group when editing */
        .edit-action-buttons {
            display: flex;
            gap: 0.75rem; /* Space between the two buttons */
            align-items: center;
            justify-content: center; /* Center the group */
            margin-top: 1rem; /* Space from inputs above */
            margin-bottom: 1rem; /* Space before history card */
        }

        .edit-action-buttons .primary-button {
            flex-grow: 1; /* Allow update button to grow */
            margin-bottom: 0; /* Remove individual button margin */
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back</span> {/* Added span for the text */}
          </button>
        )}
        <h1 className="app-title">
          Attendance Calculator
        </h1>

        {/* Dynamic message banner with animation */}
        <div className={`message-banner-container ${message ? 'visible' : ''}`}>
          {message && (
            <div
              className={`message-banner ${messageType === 'error' ? 'error' : 'success'}`}
              role="alert"
              onClick={dismissMessage}
            >
              <span className="message-banner-text">{message}</span>
              <button
                className="message-close-btn"
                title="Dismiss"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="periodName" className="form-label">Period Name (e.g., March 2025)</label>
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
            <label htmlFor="totalWorkingDays" className="form-label">Total Working Days</label>
            <input
              type="number"
              id="totalWorkingDays"
              className="form-input read-only"
              value={totalWorkingDays}
              readOnly
            />
          </div>
          <div className="flex-item">
            <label htmlFor="extraHolidays" className="form-label">Extra Holidays</label>
            <input
              type="number"
              id="extraHolidays"
              className="form-input"
              value={extraHolidays}
              onChange={(e) => {
                const val = e.target.value;
                setExtraHolidays(val === '' ? '' : Math.max(0, parseInt(val)));
                setShowAttendanceDisplayInButton(false);
                setAttendancePercentage(null);
              }}
              placeholder="e.g., 2"
              min="0"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="daysAttended" className="form-label">Days Attended</label>
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

        {/* New button group for edit mode actions */}
        {editingRecordId ? (
            <div className="edit-action-buttons">
                <button
                    onClick={primaryButtonOnClick} // This will be Update Record
                    disabled={!periodName.trim() || totalWorkingDays <= 0 || daysAttended === '' || isNaN(parseFloat(daysAttended))}
                    className={`primary-button btn-shadow ${showAttendanceDisplayInButton && attendancePercentage !== null ? 'morphed-button-display' : 'morphed-button'} ${(!periodName.trim() || totalWorkingDays <= 0 || daysAttended === '' || isNaN(parseFloat(daysAttended))) ? 'disabled' : ''}`}
                >
                    {showAttendanceDisplayInButton && attendancePercentage !== null ? (
                        <p className="attendance-percentage-display">
                            Your Attendance: <span className="attendance-percentage-value">{attendancePercentage}%</span>
                        </p>
                    ) : (
                        primaryButtonText
                    )}
                </button>
                <div className="plus-one-container">
                                      <button
                      onClick={handlePlusOne}
                      className={`plus-one-button ${isPlusOneFlashing ? 'flashing' : ''}`}
                      disabled={
                          !periodName.trim() ||
                          totalWorkingDays <= 0 ||
                          parseFloat(daysAttended) >= totalWorkingDays ||
                          (daysAttended === '' || isNaN(parseFloat(daysAttended)))
                      }
                      title="Add 1 to Days Attended"
                  >
                      <span className={`plus-one-text ${showPlusOneTick ? 'hide' : ''}`}>+1</span>
                      <span className={`plus-one-icon ${showPlusOneTick ? 'show' : ''}`}>&#10003;</span>
                  </button>
                </div>
            </div>
        ) : (
            <>
                {/* Original Calculate Attendance button for new records */}
                <button
                    onClick={primaryButtonOnClick}
                    disabled={!periodName.trim() || totalWorkingDays <= 0 || daysAttended === '' || isNaN(parseFloat(daysAttended))}
                    className={`primary-button btn-shadow ${showAttendanceDisplayInButton && attendancePercentage !== null ? 'morphed-button-display' : 'morphed-button'} ${(!periodName.trim() || totalWorkingDays <= 0 || daysAttended === '' || isNaN(parseFloat(daysAttended))) ? 'disabled' : ''}`}
                >
                    {showAttendanceDisplayInButton && attendancePercentage !== null ? (
                        <p className="attendance-percentage-display">
                            Your Attendance: <span className="attendance-percentage-value">{attendancePercentage}%</span>
                        </p>
                    ) : (
                        primaryButtonText
                    )}
                </button>
                {/* Original Save Attendance Record button for new records */}
                <button
                    onClick={saveOrUpdateAttendance}
                    disabled={!periodName.trim() || totalWorkingDays <= 0 || daysAttended === '' || isNaN(parseFloat(daysAttended)) || attendancePercentage === null}
                    className={`primary-button btn-shadow save-button ${(!periodName.trim() || totalWorkingDays <= 0 || daysAttended === '' || isNaN(parseFloat(daysAttended)) || attendancePercentage === null) ? 'disabled' : ''}`}
                >
                    Save Attendance Record
                </button>
            </>
        )}
      </div>

      {/* Historical Records Display */}
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
                // Only allow editing if not the current editing record
                onClick={() => { if (editingRecordId !== record.id) handleEditRecord(record); }}
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
                    <p className="record-extra-holidays">Extra Holidays: {record.extraHolidays}</p>
                  )}
                  {record.timestamp && (
                    <p className="record-timestamp">
                      Saved: {new Date(record.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  // Passed event 'e' to stop propagation
                  onClick={(e) => handleDeleteClick(e, record)}
                  className={`delete-button ${editingRecordId === record.id ? 'disabled' : ''}`}
                  aria-label="Delete record"
                  disabled={editingRecordId === record.id} // Disable if this is the current editing record
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Yearly Summary Section */}
      {yearlySummaries.length > 0 && (
        <div 
          className="yearly-summary-card"
        >
          <h2 className="yearly-summary-title">
            Yearly Overview
          </h2>
          <div className="yearly-summary-content">
            {yearlySummaries.map(summary => (
                <div key={summary.year} className="yearly-summary-line-group"> {/* Group lines for better spacing */}
                    <div className="yearly-summary-line">
                        <span>Year:</span>
                        <span className="yearly-summary-value">{summary.year}</span>
                    </div>
                    <div className="yearly-summary-line">
                        <span>Total Working Days:</span>
                        <span className="yearly-summary-value">{summary.totalWorkingDays}</span>
                    </div>
                    <div className="yearly-summary-line">
                        <span>Total Days Attended:</span>
                        <span className="yearly-summary-value">{summary.totalDaysAttended}</span>
                    </div>
                    <div className="yearly-summary-line">
                        <span>Overall Percentage:</span>
                        <span className="yearly-summary-value">{summary.yearlyPercentage}%</span>
                    </div>
                </div>
            ))}
          </div>
        </div>
      )}

      <footer className="footer">
        Made with ❤️ by Divyansh
      </footer>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Confirm Delete</h3>
            <p className="modal-message">
              Are you sure you want to delete the attendance record for "{recordToDelete?.periodName}"?
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