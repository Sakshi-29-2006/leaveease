
const form = document.getElementById('leaveForm');
const nameInput = document.getElementById('employee_name');
const emailInput = document.getElementById('email');
const departmentInput = document.getElementById('department');
const leaveTypeInput = document.getElementById('leave_type');
const startDate = document.getElementById('start_date');
const endDate = document.getElementById('end_date');
const reason = document.getElementById('reason');
const charCount = document.getElementById('charCount');
const formMessage = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');
const resetButton = document.getElementById('resetButton');
const refreshButton = document.getElementById('refreshButton');
const toastContainer = document.getElementById('toastContainer');
const historyBody = document.getElementById('historyBody');
const historyEmail = document.getElementById('historyEmail');
const historyEmailError = document.getElementById('historyEmailError');

const fields = [
    nameInput,
    emailInput,
    departmentInput,
    leaveTypeInput,
    startDate,
    endDate,
    reason
];

const namePattern = /^[A-Za-z][A-Za-z '-]{0,79}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function updateDateRestrictions() {
    const today = getLocalDate();

    startDate.min = today;
    endDate.min = startDate.value || today;

    if (endDate.value && startDate.value && endDate.value < startDate.value) {
        endDate.value = '';
    }
}

function updateCharacterCount() {
    charCount.textContent = reason.value.length;

    charCount.parentElement.classList.toggle(
        'limit-warning',
        reason.value.length >= 450
    );
}

function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '!',
        warning: '!',
        info: 'i'
    };

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = icons[type] || 'i';

    const content = document.createElement('div');
    content.className = 'toast-content';

    const heading = document.createElement('strong');
    heading.textContent = title;

    const description = document.createElement('p');
    description.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Dismiss notification');

    content.append(heading, description);
    toast.append(icon, content, closeButton);
    toastContainer.appendChild(toast);

    const timeout = setTimeout(() => toast.remove(), 5000);

    closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        toast.remove();
    });
}

function showFormMessage(type, title, messages = []) {
    formMessage.replaceChildren();
    formMessage.className = `message ${type}`;

    const heading = document.createElement('strong');
    heading.textContent = title;
    formMessage.appendChild(heading);

    if (messages.length) {
        const list = document.createElement('ul');

        messages.forEach(message => {
            const item = document.createElement('li');
            item.textContent = message;
            list.appendChild(item);
        });

        formMessage.appendChild(list);
    }

    formMessage.classList.remove('hidden');
}

function clearFormMessage() {
    formMessage.replaceChildren();
    formMessage.className = 'message hidden';
}

function setFieldError(field, message) {
    const errorElement = document.querySelector(
        `[data-error="${field.name}"]`
    );

    field.setAttribute('aria-invalid', 'true');

    if (errorElement) {
        errorElement.textContent = message;
    }
}

function clearFieldError(field) {
    const errorElement = document.querySelector(
        `[data-error="${field.name}"]`
    );

    field.removeAttribute('aria-invalid');

    if (errorElement) {
        errorElement.textContent = '';
    }
}

function validateField(field) {
    const value = field.value.trim();
    let error = '';

    switch (field.name) {
        case 'employee_name':
            if (!value) {
                error = 'Please enter your full name.';
            } else if (value.length < 2 || value.length > 80) {
                error = 'Name must contain 2–80 characters.';
            } else if (!namePattern.test(value)) {
                error = 'Name must start with a letter and contain only letters, spaces, hyphens or apostrophes.';
            }
            break;

        case 'email':
            if (!value) {
                error = 'Please enter your email address.';
            } else if (value.length > 254 || !emailPattern.test(value)) {
                error = 'Please enter a valid email address.';
            }
            break;

        case 'department':
            if (!value) {
                error = 'Please select your department.';
            }
            break;

        case 'leave_type':
            if (!value) {
                error = 'Please select a leave type.';
            }
            break;

        case 'start_date':
            if (!value) {
                error = 'Please select a start date.';
            } else if (value < getLocalDate()) {
                error = 'Start date cannot be in the past.';
            }
            break;

        case 'end_date':
            if (!value) {
                error = 'Please select an end date.';
            } else if (value < getLocalDate()) {
                error = 'End date cannot be in the past.';
            } else if (startDate.value && value < startDate.value) {
                error = 'End date cannot be before the start date.';
            }
            break;

        case 'reason':
            if (!value) {
                error = 'Please enter a reason for leave.';
            } else if (value.length < 10) {
                error = 'Reason must contain at least 10 characters.';
            } else if (value.length > 500) {
                error = 'Reason cannot exceed 500 characters.';
            }
            break;
    }

    if (error) {
        setFieldError(field, error);
        return error;
    }

    clearFieldError(field);
    return '';
}

function getFormErrors() {
    const errors = [];

    fields.forEach(field => {
        const message = validateField(field);

        if (message) {
            errors.push({ field, message });
        }
    });

    return errors;
}

function resetValidation() {
    clearFormMessage();

    fields.forEach(clearFieldError);

    updateDateRestrictions();
    updateCharacterCount();
}

function validateAndNotify(field) {
    const error = validateField(field);

    if (error) {
        showToast('error', 'Check this field', error);
    }
}

fields.forEach(field => {
    field.addEventListener('blur', () => validateAndNotify(field));

    field.addEventListener('input', () => {
        clearFieldError(field);
        clearFormMessage();

        if (field === reason) {
            updateCharacterCount();
        }

        if (field === nameInput) {
            field.value = field.value.replace(/^\s+/, '');
        }
    });

    field.addEventListener('change', () => {
        clearFieldError(field);
        clearFormMessage();
    });
});

startDate.addEventListener('change', () => {
    updateDateRestrictions();
    validateField(startDate);

    if (endDate.value) {
        validateField(endDate);
    }
});

endDate.addEventListener('change', () => {
    validateField(endDate);
});

async function readResponse(response) {
    const data = await response.json().catch(() => ({
        success: false,
        message: 'The server returned an invalid response.'
    }));

    if (!response.ok && !data.message) {
        data.message = `Request failed with status ${response.status}.`;
    }

    return data;
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    clearFormMessage();

    const validationErrors = getFormErrors();

    if (validationErrors.length) {
        const messages = validationErrors.map(error => error.message);

        showFormMessage(
            'error',
            `Please correct ${validationErrors.length} validation error${validationErrors.length === 1 ? '' : 's'}:`,
            messages
        );

        showToast(
            'error',
            'Validation failed',
            'Please correct the fields highlighted in red.'
        );

        validationErrors[0].field.focus();
        formMessage.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        return;
    }

    submitButton.disabled = true;
    submitButton.querySelector('.button-label').textContent = 'Submitting...';

    try {
        const response = await fetch('/api/leave-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employee_name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                department: departmentInput.value,
                leave_type: leaveTypeInput.value,
                start_date: startDate.value,
                end_date: endDate.value,
                reason: reason.value.trim()
            })
        });

        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            if (Array.isArray(data.errors)) {
                data.errors.forEach(error => {
                    const field = fields.find(
                        item => item.name === error.field
                    );

                    if (field) {
                        setFieldError(field, error.message);
                    }
                });
            }

            const messages = Array.isArray(data.errors)
                ? data.errors.map(error => error.message)
                : [data.message || 'Unable to submit the request.'];

            showFormMessage('error', 'Server-side validation failed', messages);

            showToast(
                'error',
                'Request not submitted',
                data.message || 'Please check the highlighted fields.'
            );

            const firstInvalidField = fields.find(
                field => field.getAttribute('aria-invalid') === 'true'
            );

            if (firstInvalidField) {
                firstInvalidField.focus();
            }

            return;
        }

        showFormMessage(
            'success',
            'Leave request submitted successfully!',
            [
                `Request ID: ${data.requestId}`,
                `Status: ${data.status}`,
                'Your request has been saved in the database.'
            ]
        );

        showToast(
            'success',
            'Request submitted',
            `Your leave request #${data.requestId} has been saved successfully.`
        );

        const submittedEmail = emailInput.value.trim();

        form.reset();
        resetValidation();

        emailInput.value = submittedEmail;
        historyEmail.value = submittedEmail;

        await loadHistory(false);
    } catch (error) {
        console.error('Submission error:', error);

        showFormMessage(
            'error',
            'Connection error',
            ['Unable to contact the server. Check that LeaveEase is running and try again.']
        );

        showToast(
            'error',
            'Server unavailable',
            'Please check your connection and try again.'
        );
    } finally {
        submitButton.disabled = false;
        submitButton.querySelector('.button-label').textContent = 'Validate request';
    }
});

form.addEventListener('reset', () => {
    setTimeout(() => {
        resetValidation();

        showToast(
            'info',
            'Form cleared',
            'All form fields have been reset.'
        );
    }, 0);
});

function createCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value ?? '';
    return cell;
}

function displayHistory(requests) {
    historyBody.replaceChildren();

    if (!requests.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.colSpan = 6;
        cell.className = 'empty-state';
        cell.textContent = 'No leave requests found for this email.';

        row.appendChild(cell);
        historyBody.appendChild(row);
        updateStatistics(requests);
        return;
    }

    requests.forEach(request => {
        const row = document.createElement('tr');

        row.appendChild(createCell(`#${request.id}`));
        row.appendChild(createCell(request.leave_type));
        row.appendChild(createCell(request.start_date));
        row.appendChild(createCell(request.end_date));

        const statusCell = createCell(request.status);
        statusCell.classList.add(
            'status',
            String(request.status).toLowerCase()
        );
        row.appendChild(statusCell);

        row.appendChild(createCell(request.admin_remark || '—'));

        historyBody.appendChild(row);
    });

    updateStatistics(requests);
}

function updateStatistics(requests) {
    document.getElementById('totalCount').textContent = requests.length;
    document.getElementById('pendingCount').textContent =
        requests.filter(request => request.status === 'Pending').length;
    document.getElementById('approvedCount').textContent =
        requests.filter(request => request.status === 'Approved').length;
}

async function loadHistory(notify = true) {
    const searchEmail = historyEmail.value.trim();

    historyEmailError.textContent = '';

    if (!searchEmail) {
        historyEmailError.textContent = 'Please enter your email address.';
        historyEmail.focus();
        return;
    }

    if (searchEmail.length > 254 || !emailPattern.test(searchEmail)) {
        historyEmailError.textContent = 'Please enter a valid email address.';
        historyEmail.focus();
        return;
    }

    refreshButton.disabled = true;
    refreshButton.textContent = 'Searching...';

    try {
        const response = await fetch(
            `/api/leave-requests?email=${encodeURIComponent(searchEmail)}`
        );

        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Could not load request history.');
        }

        displayHistory(data.requests);

        if (notify) {
            showToast(
                'success',
                'History updated',
                `${data.count} leave request${data.count === 1 ? '' : 's'} found.`
            );
        }
    } catch (error) {
        console.error('History error:', error);

        showToast(
            'error',
            'History unavailable',
            error.message || 'Unable to load your request history.'
        );
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Search requests';
    }
}

refreshButton.addEventListener('click', () => loadHistory());

historyEmail.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        loadHistory();
    }
});

historyEmail.addEventListener('input', () => {
    historyEmailError.textContent = '';
});

updateDateRestrictions();
updateCharacterCount();
