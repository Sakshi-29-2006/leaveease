const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const refreshButton = document.getElementById('refreshButton');
const loginMessage = document.getElementById('loginMessage');
const dashboardMessage = document.getElementById('dashboardMessage');
const requestsTableBody = document.getElementById('requestsTableBody');
const statusFilter = document.getElementById('statusFilter');
const searchInput = document.getElementById('searchInput');

let allRequests = [];

function showMessage(element, message, type = 'error') {
    element.textContent = message;
    element.className = `message ${type}`;
    element.hidden = false;
}

function hideMessage(element) {
    element.textContent = '';
    element.hidden = true;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error('The server returned an invalid response.');
    }

    if (!response.ok) {
        if (response.status === 401) {
            showLogin();
        }

        throw new Error(data.message || 'The request could not be completed.');
    }

    return data;
}

function showLogin() {
    loginSection.hidden = false;
    dashboardSection.hidden = true;
}

function showDashboard(admin) {
    loginSection.hidden = true;
    dashboardSection.hidden = false;

    document.getElementById('adminUsername').textContent =
        admin.username || 'Administrator';
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    hideMessage(loginMessage);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';

    try {
        const data = await apiRequest('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        loginForm.reset();
        showDashboard(data.admin);
        showMessage(dashboardMessage, data.message, 'success');

        await loadDashboard();
    } catch (error) {
        showMessage(loginMessage, error.message);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Sign In';
    }
});

async function checkSession() {
    try {
        const data = await apiRequest('/api/admin/me');
        showDashboard(data.admin);
        await loadDashboard();
    } catch {
        showLogin();
    }
}

async function loadStats() {
    const data = await apiRequest('/api/admin/stats');

    document.getElementById('totalCount').textContent = data.stats.total;
    document.getElementById('pendingCount').textContent = data.stats.pending;
    document.getElementById('approvedCount').textContent = data.stats.approved;
    document.getElementById('rejectedCount').textContent = data.stats.rejected;
}

async function loadRequests() {
    requestsTableBody.innerHTML = `
        <tr><td colspan="7" class="empty-state">Loading requests...</td></tr>
    `;

    const status = statusFilter.value;
    const url = status
        ? `/api/admin/leave-requests?status=${encodeURIComponent(status)}`
        : '/api/admin/leave-requests';

    try {
        const data = await apiRequest(url);
        allRequests = data.requests;
        renderRequests();
    } catch (error) {
        requestsTableBody.innerHTML = `
            <tr><td colspan="7" class="empty-state">${escapeHTML(error.message)}</td></tr>
        `;
        throw error;
    }
}

async function loadDashboard() {
    hideMessage(dashboardMessage);

    try {
        await Promise.all([loadStats(), loadRequests()]);
    } catch (error) {
        showMessage(dashboardMessage, error.message);
    }
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function formatDate(value) {
    if (!value) return '—';

    const parts = String(value).split('-');

    if (parts.length !== 3) return escapeHTML(value);

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getStatusClass(status) {
    if (status === 'Approved') return 'status-approved';
    if (status === 'Rejected') return 'status-rejected';
    return 'status-pending';
}

function renderRequests() {
    const search = searchInput.value.trim().toLowerCase();

    const filteredRequests = allRequests.filter(request => {
        const searchableText = [
            request.employee_name,
            request.email,
            request.department,
            request.leave_type,
            request.reason
        ].join(' ').toLowerCase();

        return searchableText.includes(search);
    });

    if (filteredRequests.length === 0) {
        requestsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No leave requests match your search.
                </td>
            </tr>
        `;

        document.getElementById('requestCount').textContent = '0 requests found.';
        return;
    }

    requestsTableBody.innerHTML = filteredRequests.map(request => {
        const isPending = request.status === 'Pending';

        return `
            <tr>
                <td>#${escapeHTML(request.id)}</td>
                <td>
                    <strong>${escapeHTML(request.employee_name)}</strong><br>
                    ${escapeHTML(request.email)}<br>
                    <span>${escapeHTML(request.department)}</span>
                </td>
                <td>
                    <strong>${escapeHTML(request.leave_type)}</strong><br>
                    ${formatDate(request.start_date)} – ${formatDate(request.end_date)}
                </td>
                <td>${escapeHTML(request.reason)}</td>
                <td>
                    <span class="status-badge ${getStatusClass(request.status)}">
                        ${escapeHTML(request.status)}
                    </span>
                </td>
                <td>
                    ${isPending
                        ? `<input class="remark-input" id="remark-${escapeHTML(request.id)}"
                            maxlength="500" placeholder="Optional remark"
                            aria-label="Admin remark for request ${escapeHTML(request.id)}">`
                        : escapeHTML(request.admin_remark || '—')}
                </td>
                <td>
                    ${isPending ? `
                        <div class="request-actions">
                            <button class="btn btn-approve"
                                data-id="${escapeHTML(request.id)}"
                                data-status="Approved">Approve</button>
                            <button class="btn btn-reject"
                                data-id="${escapeHTML(request.id)}"
                                data-status="Rejected">Reject</button>
                        </div>
                    ` : '—'}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('requestCount').textContent =
        `Showing ${filteredRequests.length} of ${allRequests.length} requests.`;
}

requestsTableBody.addEventListener('click', async event => {
    const button = event.target.closest('button[data-id][data-status]');

    if (!button) return;

    const id = button.dataset.id;
    const status = button.dataset.status;

    const confirmation = status === 'Approved'
        ? 'Are you sure you want to approve this leave request?'
        : 'Are you sure you want to reject this leave request?';

    if (!window.confirm(confirmation)) return;

    const remarkInput = document.getElementById(`remark-${id}`);
    const admin_remark = remarkInput ? remarkInput.value.trim() : '';

    button.disabled = true;
    hideMessage(dashboardMessage);

    try {
        const data = await apiRequest(`/api/admin/leave-requests/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, admin_remark })
        });

        showMessage(dashboardMessage, data.message, 'success');
        await loadDashboard();
    } catch (error) {
        showMessage(dashboardMessage, error.message);
    } finally {
        button.disabled = false;
    }
});

statusFilter.addEventListener('change', async () => {
    hideMessage(dashboardMessage);

    try {
        await loadRequests();
    } catch (error) {
        showMessage(dashboardMessage, error.message);
    }
});

searchInput.addEventListener('input', renderRequests);

refreshButton.addEventListener('click', loadDashboard);

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;

    try {
        const data = await apiRequest('/api/admin/logout', {
            method: 'POST'
        });

        showLogin();
        hideMessage(loginMessage);
        loginForm.reset();
        allRequests = [];
        window.location.reload();
    } catch (error) {
        showMessage(dashboardMessage, error.message);
    } finally {
        logoutButton.disabled = false;
    }
});

checkSession();