import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, update, remove, push, serverTimestamp } from 'firebase/database';
import {
Search, Camera, Trash2, ShieldCheck, LogOut, User, ImageOff,
CheckCircle2, X, RefreshCw, ChevronUp, Users, Image as ImageIcon,
AlertTriangle, History, FlipHorizontal, Filter, ArrowUpDown, LayoutGrid,
Grid3X3, List, Eye, EyeOff, MoreVertical, Clock, Database, Shield, Folder,
Activity, Calendar, UserCheck, CameraIcon, Image as ImageIcon2, Info,
UserPlus, UserX, Lock, Unlock, BarChart3, Download, FileText, SortAsc, SortDesc
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// --- Configuration ---
const firebaseConfig = {
apiKey: "AIzaSyAc2g-t9A7du3K_nI2fJnw_OGxhmLfpP6s",
authDomain: "dilistname.firebaseapp.com",
databaseURL: "https://dilistname-default-rtdb.firebaseio.com",
projectId: "dilistname",
storageBucket: "dilistname.firebasestorage.app",
messagingSenderId: "897983357871",
appId: "1:897983357871:web:42a046bc9fb3e0543dc55a",
measurementId: "G-NQ798D9J6K"
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dttx1x743/image/upload";
const CLOUDINARY_PRESET = "difulllist";
const ALLOWED_ADMIN_IDS = ['250', '246', '249', '247', '273', '169'];

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- Main App Component ---
export default function App() {
// Global State
const [currentUser, setCurrentUser] = useState(null);
const [adminProfile, setAdminProfile] = useState(null);
const [allStudents, setAllStudents] = useState([]);
const [adminLogs, setAdminLogs] = useState([]);
const [allAdminLogs, setAllAdminLogs] = useState([]);
const [adminList, setAdminList] = useState([]);
const [capturedCount, setCapturedCount] = useState(0);
const [loading, setLoading] = useState(true);

// UI State
const [activeTab, setActiveTab] = useState('home');
const [searchQuery, setSearchQuery] = useState('');
const [displayLimit, setDisplayLimit] = useState(20);

// Feature States
const [cameraState, setCameraState] = useState({ isOpen: false, studentId: null, studentName: null });
const [previewState, setPreviewState] = useState({ isOpen: false, blob: null, isUploading: false });

// Custom Modal States
const [alertState, setAlertState] = useState({ isOpen: false, message: '', type: 'success' });
const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
const [addAdminState, setAddAdminState] = useState({ isOpen: false, adminId: '', adminName: '' });
const [selectedAdminDetails, setSelectedAdminDetails] = useState(null);

// Delete tab specific states
const [deleteViewMode, setDeleteViewMode] = useState('grid');
const [selectedImages, setSelectedImages] = useState(new Set());
const [showBatchActions, setShowBatchActions] = useState(false);

// Admin details modal states
const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
const [filterType, setFilterType] = useState('all'); // 'all', 'upload', 'delete'
const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'

// --- Effects ---
useEffect(() => {
const savedAdmin = localStorage.getItem('adminData');
if (savedAdmin) setAdminProfile(JSON.parse(savedAdmin));

const unsubAuth = onAuthStateChanged(auth, (user) => {
setCurrentUser(user);
if (!user) signInAnonymously(auth);
});

const studentsRef = ref(db, 'students');
const unsubData = onValue(studentsRef, (snapshot) => {
setLoading(true);
const data = snapshot.val();
if (data) {
const list = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
list.sort((a, b) => parseInt(a.id) - parseInt(b.id));
setAllStudents(list);

// Count captured users
const captured = list.filter(s => s['រូបថត'] && s['រូបថត'] !== 'n/a' && s['រូបថត'] !== "").length;
setCapturedCount(captured);

// Create admin list from ALLOWED_ADMIN_IDS
const admins = ALLOWED_ADMIN_IDS.map(id => {
const student = list.find(s => s.id === id);
return {
id: id,
name: student ? student['ឈ្មោះ'] : `Admin ${id}`,
isBlocked: student ? (student.isBlocked || false) : false
};
});
setAdminList(admins);
} else {
setAllStudents([]);
setCapturedCount(0);
setAdminList([]);
}
setLoading(false);
});

return () => { unsubAuth(); unsubData(); };
}, []);

// Effect to fetch admin logs when admin profile changes
useEffect(() => {
if (!adminProfile) return;

const adminLogsRef = ref(db, `admin_logs/${adminProfile.id}`);
const unsubLogs = onValue(adminLogsRef, (snapshot) => {
const data = snapshot.val();
if (data) {
const logs = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
logs.sort((a, b) => {
if (!a.timestamp) return 1;
if (!b.timestamp) return -1;
return b.timestamp - a.timestamp;
});
setAdminLogs(logs);
} else {
setAdminLogs([]);
}
});

return () => unsubLogs();
}, [adminProfile]);

// Effect to fetch all admin logs for superadmin
useEffect(() => {
if (!adminProfile || adminProfile.id !== '250') return;

const allLogsRef = ref(db, 'admin_logs');
const unsubAllLogs = onValue(allLogsRef, (snapshot) => {
const data = snapshot.val();
if (data) {
const allLogs = [];
Object.entries(data).forEach(([adminId, logs]) => {
if (logs) {
Object.entries(logs).forEach(([logId, log]) => {
allLogs.push({ adminId, ...log, id: logId });
});
}
});
setAllAdminLogs(allLogs);
} else {
setAllAdminLogs([]);
}
});

return () => unsubAllLogs();
}, [adminProfile]);

// --- Derived Data ---
const filteredStudents = useMemo(() => {
let result = allStudents;

if (searchQuery) {
const q = searchQuery.toLowerCase();
result = result.filter(s =>
(s.id && s.id.toString().includes(q)) ||
(s['ឈ្មោះ'] && s['ឈ្មោះ'].toLowerCase().includes(q))
);
}

if (activeTab === 'pending') {
result = result.filter(s => !s['រូបថត'] || s['រូបថត'] === 'n/a' || s['រូបថត'] === "");
} else if (activeTab === 'delete') {
result = result.filter(s =>
s['រូបថត'] &&
s['រូបថត'] !== 'n/a' &&
s['រូបថត'] !== "" &&
s['រូបថត'].includes('cloudinary')
);
}

return result;
}, [allStudents, searchQuery, activeTab]);

const visibleStudents = useMemo(() => filteredStudents.slice(0, displayLimit), [filteredStudents, displayLimit]);

// Calculate admin capture statistics
const adminCaptureStats = useMemo(() => {
if (!adminProfile || adminProfile.id !== '250') return [];

const stats = ALLOWED_ADMIN_IDS.map(adminId => {
const admin = adminList.find(a => a.id === adminId);
const uploadLogs = allAdminLogs.filter(log =>
log.adminId === adminId && log.action === 'UPLOAD_PHOTO'
);
const deleteLogs = allAdminLogs.filter(log =>
log.adminId === adminId && log.action === 'DELETE_PHOTO'
);

return {
adminId,
name: admin ? admin.name : `Admin ${adminId}`,
isBlocked: admin ? admin.isBlocked : false,
uploadCount: uploadLogs.length,
deleteCount: deleteLogs.length,
lastUpload: uploadLogs.length > 0 ? uploadLogs[0].timestamp : null
};
});

return stats.sort((a, b) => b.uploadCount - a.uploadCount);
}, [adminList, allAdminLogs]);

// Check if current admin is superadmin
const isSuperAdmin = adminProfile && adminProfile.id === '250';

// --- Actions ---
const showAlert = (message, type = 'success') => {
setAlertState({ isOpen: true, message, type });
setTimeout(() => setAlertState(prev => ({ ...prev, isOpen: false })), 3000);
};

const showConfirm = (title, message, onConfirm) => {
setConfirmState({ isOpen: true, title, message, onConfirm });
};

const handleLogin = (adminId) => {
// Check if ID is in allowed list first
if (!ALLOWED_ADMIN_IDS.includes(adminId)) {
showAlert('លេខអ្នកគ្រប់គ្រងមិនត្រឹមត្រូវ', 'error');
return;
}

// Find admin in adminList
const admin = adminList.find(a => a.id === adminId);
if (!admin) {
showAlert('រកសិស្សិតមិនត្រឹមត្រូវ', 'error');
return;
}

if (admin.isBlocked) {
showAlert('គណនីអ្នកគ្រប់គ្រងត្រូវបានបិទ', 'error');
return;
}

const profile = {
id: adminId,
name: admin.name,
verified: true,
isSuperAdmin: adminId === '250'
};
setAdminProfile(profile);
localStorage.setItem('adminData', JSON.stringify(profile));
showAlert(`សូមត្រឡប់មកវិញ, ${admin.name}`);
};

const handleLogout = () => {
showConfirm('ចេញចេញ', 'តើអ្នកពិតបណ្ណានចង់វគ្នជាមួយអ្នកគ្រប់គ្រងឬ?', () => {
setAdminProfile(null);
localStorage.removeItem('adminData');
setActiveTab('home');
setConfirmState({ isOpen: false, title: '', message: '', onConfirm: null });
});
};

const handleDeletePhoto = (studentId) => {
showConfirm('លុបរូបភាព', 'សកម្មភាពនេះមិនអាចត្រូវបានឡើងវិញ។ លុបរូបភាពរបស់និស្សិត?', async () => {
try {
await update(ref(db, `students/${studentId}`), { 'រូបថត': "" });
push(ref(db, `admin_logs/${adminProfile.id}`), {
action: 'DELETE_PHOTO',
studentId,
timestamp: serverTimestamp()
});
showAlert('លុបរូបភាពបានជោគជោគ!');
} catch (err) {
showAlert('បរាប់ក្នុងការលុបរូបភាព', 'error');
}
setConfirmState({ isOpen: false, title: '', message: '', onConfirm: null });
});
};

const handleBatchDelete = () => {
const count = selectedImages.size;
showConfirm(
'លុបរូបភាពជាក្រុម',
`សកម្មភាពនេះមិនអាចត្រូវបានឡើងវិញ។ លុបរូបភាពនិស្សិត ${count} រូប?`,
async () => {
try {
const updates = {};
selectedImages.forEach(studentId => {
updates[`students/${studentId}/រូបថត`] = "";
});
await update(ref(db), updates);

push(ref(db, `admin_logs/${adminProfile.id}`), {
action: 'BATCH_DELETE_PHOTOS',
count,
timestamp: serverTimestamp()
});

showAlert(`លុបរូបភាព ${count} បានជោគជោគ!`);
setSelectedImages(new Set());
setShowBatchActions(false);
} catch (err) {
showAlert('បរាប់ក្នុងការលុបរូបភាព', 'error');
}
setConfirmState({ isOpen: false, title: '', message: '', onConfirm: null });
}
);
};

const toggleImageSelection = (studentId) => {
const newSelection = new Set(selectedImages);
if (newSelection.has(studentId)) {
newSelection.delete(studentId);
} else {
newSelection.add(studentId);
}
setSelectedImages(newSelection);
setShowBatchActions(newSelection.size > 0);
};

const handleBlockAdmin = (adminId, isBlocked) => {
const action = isBlocked ? 'ដោះទ្រា' : 'អនុញ្ញាត';
showConfirm(
`${action} អ្នកគ្រប់គ្រង`,
`តើអ្នកពិតបណ្ណានចង់វ${action}អ្នកគ្រប់គ្រងនេះ?`,
async () => {
try {
await update(ref(db, `students/${adminId}`), { isBlocked: !isBlocked });
showAlert(`${action}អ្នកគ្រប់គ្រងបានជោគជោគ!`);
setConfirmState({ isOpen: false, title: '', message: '', onConfirm: null });
} catch (err) {
showAlert('បរាប់ក្នុងការធ្វើនិង', 'error');
}
}
);
};

const handleAddAdmin = () => {
if (!addAdminState.adminId || !addAdminState.adminName) {
showAlert('សូមបញ្ចូលព័ត៌មានគ្រប់គ្រង', 'error');
return;
}

const student = allStudents.find(s => s.id === addAdminState.adminId);
if (!student) {
showAlert('រកសិស្សិតមិនត្រឹមត្រូវ', 'error');
return;
}

showConfirm(
'បន្ថែមអ្នកគ្រប់គ្រងថ្មី',
`បន្ថែម ${addAdminState.adminName} ជាអ្នកគ្រប់គ្រង?`,
async () => {
try {
await update(ref(db, `students/${addAdminState.adminId}`), {
isAdmin: true,
isBlocked: false
});
showAlert('បន្ថែមអ្នកគ្រប់គ្រងបានជោគជោគ!');
setAddAdminState({ isOpen: false, adminId: '', adminName: '' });
setConfirmState({ isOpen: false, title: '', message: '', onConfirm: null });
} catch (err) {
showAlert('បរាប់ក្នុងការបន្ថែមអ្នកគ្រប់គ្រង', 'error');
}
}
);
};

const handleViewAdminDetails = (adminId) => {
const admin = adminList.find(a => a.id === adminId);
if (admin) {
setSelectedAdminDetails(admin);
}
};

const handleExportAdminData = async (adminId) => {
const admin = adminList.find(a => a.id === adminId);
if (!admin) return;

// Get all logs for this admin
const adminLogs = allAdminLogs.filter(log => log.adminId === adminId);

// Get all photos uploaded by this admin
const uploadLogs = adminLogs.filter(log => log.action === 'UPLOAD_PHOTO');
const deleteLogs = adminLogs.filter(log => log.action === 'DELETE_PHOTO');

// Get all students with photos uploaded by this admin
const uploadedStudents = allStudents.filter(student => {
const studentUploadLogs = adminLogs.filter(log => log.studentId === student.id && log.action === 'UPLOAD_PHOTO');
return studentUploadLogs.length > 0;
}).slice(0, 20); // Limit to 20 students for PDF

// Create PDF with custom size
const doc = new jsPDF({
orientation: 'portrait',
unit: 'mm',
format: 'a4'
});

// Load Khmer fonts from Google Fonts
try {
// Load Noto Sans Khmer fonts
await Promise.all([
fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Khmer/NotoSansKhmer-Regular.ttf')
.then(response => response.arrayBuffer())
.then(fontData => {
const base64Font = btoa(String.fromCharCode(...new Uint8Array(fontData)));
doc.addFileToVFS('NotoSansKhmer-Regular.ttf', base64Font);
doc.addFont('NotoSansKhmer-Regular.ttf', 'NotoSansKhmer', 'normal');
}),
fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Khmer/NotoSansKhmer-Bold.ttf')
.then(response => response.arrayBuffer())
.then(fontData => {
const base64Font = btoa(String.fromCharCode(...new Uint8Array(fontData)));
doc.addFileToVFS('NotoSansKhmer-Bold.ttf', base64Font);
doc.addFont('NotoSansKhmer-Bold.ttf', 'NotoSansKhmer', 'bold');
})
]);
console.log('Khmer fonts loaded successfully');
} catch (e) {
console.error('Failed to load Khmer fonts:', e);
// Continue with default font if Khmer fonts fail to load
}

// Page dimensions
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 15;
const contentWidth = pageWidth - (margin * 2);

// Helper functions - defined at the beginning
const addKhmerText = (text, x, y, size = 12, style = 'normal', align = 'left') => {
try {
// Try to use Khmer font first
doc.setFont('NotoSansKhmer', style);
doc.setFontSize(size);
if (align === 'center') {
doc.text(text, x, y, { align: 'center' });
} else {
doc.text(text, x, y);
}
} catch (e) {
// Fallback to default font if Khmer font fails
console.warn('Khmer font failed, using fallback:', e);
doc.setFont('helvetica', style);
doc.setFontSize(size);
if (align === 'center') {
doc.text(text, x, y, { align: 'center' });
} else {
doc.text(text, x, y);
}
}
};

const addText = (text, x, y, size = 12, style = 'normal', align = 'left') => {
doc.setFont('helvetica', style);
doc.setFontSize(size);
if (align === 'center') {
doc.text(text, x, y, { align: 'center' });
} else {
doc.text(text, x, y);
}
};

const drawRoundedRect = (x, y, width, height, radius) => {
doc.roundedRect(x, y, width, height, radius, radius);
};

// Custom colors
const primaryColor = [79, 70, 229]; // Indigo
const secondaryColor = [107, 114, 128]; // Gray

// Add header background
doc.setFillColor(...primaryColor);
doc.rect(0, 0, pageWidth, 60, 'F');

// Add logo (try to load, if fails use placeholder)
try {
doc.addImage('https://i.postimg.cc/FHBn0Fdf/di3-copy.png', 'PNG', margin, 10, 40, 40);
} catch (e) {
// If image fails to load, add a placeholder
doc.setFillColor(255, 255, 255);
doc.rect(margin, 10, 40, 40, 'F');
addText('LOGO', margin + 20, 30, 16, 'bold', 'center');
}

// Company name and report title
doc.setTextColor(255, 255, 255);
addKhmerText('របាយការណ៍អ្នកគ្រប់គ្រង', pageWidth / 2, 20, 20, 'bold', 'center');
addText('Admin Report', pageWidth / 2, 30, 14, 'normal', 'center');
addText('DI Learning Institute', pageWidth / 2, 40, 14, 'normal', 'center');

// Reset text color
doc.setTextColor(0, 0, 0);

// Admin info section
addKhmerText('ព័ត៌មានអ្នកគ្រប់គ្រង', margin, 75, 16, 'bold');

// Admin info table
doc.setDrawColor(200, 200, 200);
doc.setFillColor(248, 250, 252);
doc.rect(margin, 80, contentWidth, 8, 'F');
doc.rect(margin, 80, contentWidth, 8);

doc.rect(margin, 88, contentWidth, 8, 'F');
doc.rect(margin, 88, contentWidth, 8);

doc.rect(margin, 96, contentWidth, 8, 'F');
doc.rect(margin, 96, contentWidth, 8);

doc.rect(margin, 104, contentWidth, 8, 'F');
doc.rect(margin, 104, contentWidth, 8);

// Admin info content
addKhmerText('ឈ្មោះ:', margin + 2, 86, 10);
addText(admin.name, margin + 35, 86, 10, 'bold');

addKhmerText('លេខសម្គាល់:', margin + 2, 94, 10);
addText(admin.id, margin + 35, 94, 10, 'bold');

addKhmerText('កាលបរិច្ឆេទ:', margin + 2, 102, 10);
addText(new Date().toLocaleDateString('km-KH'), margin + 35, 102, 10);

addKhmerText('ម៉ោង:', margin + 2, 110, 10);
addText(new Date().toLocaleTimeString('km-KH'), margin + 35, 110, 10);

// Statistics section
let yPos = 125;
addKhmerText('ស្ថិតិ', margin, yPos, 16, 'bold');
yPos += 10;

// Statistics cards
const stats = [
{ label: 'ចំនួនរូបថតដែលបានបញ្ចូល', value: uploadLogs.length, color: [34, 197, 94] },
{ label: 'ចំនួនរូបថតដែលបានលុប', value: deleteLogs.length, color: [239, 68, 68] },
{ label: 'ចំនួននិស្សិតដែលមានរូបថត', value: uploadedStudents.length, color: [59, 130, 246] }
];

const cardWidth = contentWidth / 3 - 5;
stats.forEach((stat, index) => {
const xPos = margin + (index * (cardWidth + 5));

// Card background
doc.setFillColor(...stat.color);
drawRoundedRect(xPos, yPos, cardWidth, 30, 3);
doc.roundedRect(xPos, yPos, cardWidth, 30, 3, 3, 'F');

// Card content
doc.setTextColor(255, 255, 255);
addText(stat.value.toString(), xPos + cardWidth/2, yPos + 12, 18, 'bold', 'center');
doc.setFontSize(8);
addKhmerText(stat.label, xPos + cardWidth/2, yPos + 22, 8, 'normal', 'center');
});

doc.setTextColor(0, 0, 0);
yPos += 45;

// Student photos table
addKhmerText('បញ្ជីនិស្សិតដែលបានបញ្ចូលរូបថត', margin, yPos, 14, 'bold');
yPos += 10;

// Table headers
const tableHeaders = ['រូបភាព', 'លេខសម្គាល់', 'ឈ្មោះ', 'ជំនាញ', 'កាលបរិច្ឆេទ'];
const colWidths = [25, 25, 45, 45, 35];
const tableWidth = colWidths.reduce((a, b) => a + b, 0);
const tableStartX = (pageWidth - tableWidth) / 2;

// Header row
doc.setFillColor(...primaryColor);
doc.rect(tableStartX, yPos, tableWidth, 10, 'F');
doc.setTextColor(255, 255, 255);

let currentX = tableStartX;
tableHeaders.forEach((header, index) => {
doc.setFontSize(9);
addKhmerText(header, currentX + colWidths[index]/2, yPos + 6, 9, 'normal', 'center');
currentX += colWidths[index];
});

doc.setTextColor(0, 0, 0);
yPos += 10;

// Table rows
for (let i = 0; i < uploadedStudents.length; i++) {
const student = uploadedStudents[i];
const studentLog = adminLogs.find(log => log.studentId === student.id && log.action === 'UPLOAD_PHOTO');

// Alternate row colors
if (i % 2 === 0) {
doc.setFillColor(248, 250, 252);
doc.rect(tableStartX, yPos, tableWidth, 25, 'F');
}

// Row border
doc.setDrawColor(200, 200, 200);
doc.rect(tableStartX, yPos, tableWidth, 25);

currentX = tableStartX;

// Photo column
try {
if (student['រូបថត'] && student['រូបថត'] !== 'n/a') {
doc.addImage(student['រូបថត'], 'JPEG', currentX + 2.5, yPos + 2.5, 20, 20);
} else {
doc.setFillColor(200, 200, 200);
doc.rect(currentX + 2.5, yPos + 2.5, 20, 20, 'F');
addText('No Photo', currentX + 12.5, yPos + 12.5, 8, 'normal', 'center');
}
} catch (e) {
doc.setFillColor(200, 200, 200);
doc.rect(currentX + 2.5, yPos + 2.5, 20, 20, 'F');
}
currentX += colWidths[0];

// ID column
addText(student.id, currentX + colWidths[1]/2, yPos + 15, 10, 'normal', 'center');
currentX += colWidths[1];

// Name column
doc.setFontSize(9);
const name = student['ឈ្មោះ'] || 'N/A';
const splitName = doc.splitTextToSize(name, colWidths[2] - 4);
splitName.forEach((line, index) => {
if (yPos + 8 + (index * 5) < yPos + 25) {
doc.text(line, currentX + 2, yPos + 8 + (index * 5));
}
});
currentX += colWidths[2];

// Major column
const major = student['ជំនាញ'] || 'N/A';
const splitMajor = doc.splitTextToSize(major, colWidths[3] - 4);
splitMajor.forEach((line, index) => {
if (yPos + 8 + (index * 5) < yPos + 25) {
doc.text(line, currentX + 2, yPos + 8 + (index * 5));
}
});
currentX += colWidths[3];

// Date column
doc.setFontSize(8);
if (studentLog && studentLog.timestamp) {
const date = new Date(studentLog.timestamp);
addText(date.toLocaleDateString('km-KH'), currentX + colWidths[4]/2, yPos + 15, 8, 'normal', 'center');
} else {
addText('N/A', currentX + colWidths[4]/2, yPos + 15, 8, 'normal', 'center');
}

yPos += 25;

// Check if we need a new page
if (yPos > pageHeight - 40) {
doc.addPage();
yPos = 20;

// Add header to new page
doc.setFillColor(...primaryColor);
doc.rect(0, 0, pageWidth, 20, 'F');
doc.setTextColor(255, 255, 255);
addKhmerText('បន្តទំព័របន្ទាប់', pageWidth / 2, 13, 12, 'bold', 'center');
doc.setTextColor(0, 0, 0);
}
}

// Footer
const footerY = pageHeight - 20;
doc.setDrawColor(200, 200, 200);
doc.line(margin, footerY, pageWidth - margin, footerY);

doc.setFontSize(8);
doc.setTextColor(100, 100, 100);
addText(`ទំព័រ ${doc.internal.getNumberOfPages()}`, pageWidth / 2, footerY + 10, 8, 'normal', 'center');
addKhmerText('© 2024 DI Learning Institute - រក្សាសិទ្ធិគ្រប់យ៉ាង', pageWidth / 2, footerY + 15, 8, 'normal', 'center');

// Save the PDF
doc.save(`admin_${adminId}_report_${Date.now()}.pdf`);
showAlert('របាយការណ៍ត្រូវបាននាំចេញដោយជោគជ័យ!');
};

const handleExportAdminDataExcel = async (adminId) => {
const admin = adminList.find(a => a.id === adminId);
if (!admin) return;

// Get all logs for this admin
const adminLogs = allAdminLogs.filter(log => log.adminId === adminId);

// Get all photos uploaded by this admin
const uploadLogs = adminLogs.filter(log => log.action === 'UPLOAD_PHOTO');
const deleteLogs = adminLogs.filter(log => log.action === 'DELETE_PHOTO');

// Get all students with photos uploaded by this admin
const uploadedStudents = allStudents.filter(student => {
const studentUploadLogs = adminLogs.filter(log => log.studentId === student.id && log.action === 'UPLOAD_PHOTO');
return studentUploadLogs.length > 0;
});

// Create workbook
const wb = XLSX.utils.book_new();

// Summary Sheet
const summaryData = [
['Admin Report Summary'],
[],
['Administrator Information'],
['Name:', admin.name],
['Admin ID:', admin.id],
['Report Date:', new Date().toLocaleDateString()],
['Report Time:', new Date().toLocaleTimeString()],
[],
['Statistics'],
['Total Photos Uploaded:', uploadLogs.length],
['Total Photos Deleted:', deleteLogs.length],
['Students with Photos:', uploadedStudents.length]
];

const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

// Style summary sheet
wsSummary['A1'].s = {
font: { sz: 16, bold: true },
alignment: { horizontal: 'center' }
};

wsSummary['A3'].s = {
font: { sz: 14, bold: true }
};

XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

// Students Sheet
const studentsData = [
['Student ID', 'Name', 'Major', 'Photo URL', 'Upload Date', 'Upload Time']
];

uploadedStudents.forEach(student => {
const studentLog = adminLogs.find(log => log.studentId === student.id && log.action === 'UPLOAD_PHOTO');
const uploadDate = studentLog && studentLog.timestamp ? new Date(studentLog.timestamp) : null;

studentsData.push([
student.id,
student['ឈ្មោះ'] || 'N/A',
student['ជំនាញ'] || 'N/A',
student['រូបថត'] || 'N/A',
uploadDate ? uploadDate.toLocaleDateString() : 'N/A',
uploadDate ? uploadDate.toLocaleTimeString() : 'N/A'
]);
});

const wsStudents = XLSX.utils.aoa_to_sheet(studentsData);

// Style students sheet header
const headerRange = XLSX.utils.decode_range(wsStudents['!ref']);
for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
wsStudents[cellAddress].s = {
font: { sz: 12, bold: true },
fill: { fgColor: { rgb: "4F46E5" } },
alignment: { horizontal: 'center' }
};
}

// Auto-size columns
const colWidths = [
{ wch: 15 }, // Student ID
{ wch: 30 }, // Name
{ wch: 25 }, // Major
{ wch: 50 }, // Photo URL
{ wch: 15 }, // Upload Date
{ wch: 15 }  // Upload Time
];
wsStudents['!cols'] = colWidths;

XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');

// Activity Log Sheet
const activityData = [
['Date', 'Time', 'Action', 'Student ID', 'Student Name', 'Details']
];

adminLogs.forEach(log => {
const student = allStudents.find(s => s.id === log.studentId);
const logDate = log.timestamp ? new Date(log.timestamp) : null;
const actionText = log.action === 'UPLOAD_PHOTO' ? 'Upload Photo' :
log.action === 'DELETE_PHOTO' ? 'Delete Photo' :
log.action === 'BATCH_DELETE_PHOTOS' ? `Batch Delete ${log.count} Photos` :
log.action;

activityData.push([
logDate ? logDate.toLocaleDateString() : 'N/A',
logDate ? logDate.toLocaleTimeString() : 'N/A',
actionText,
log.studentId || 'N/A',
student ? student['ឈ្មោះ'] : 'N/A',
log.details || ''
]);
});

const wsActivity = XLSX.utils.aoa_to_sheet(activityData);

// Style activity sheet header
const activityRange = XLSX.utils.decode_range(wsActivity['!ref']);
for (let col = activityRange.s.c; col <= activityRange.e.c; col++) {
const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
wsActivity[cellAddress].s = {
font: { sz: 12, bold: true },
fill: { fgColor: { rgb: "4F46E5" } },
alignment: { horizontal: 'center' }
};
}

// Auto-size columns for activity sheet
wsActivity['!cols'] = [
{ wch: 15 }, // Date
{ wch: 15 }, // Time
{ wch: 20 }, // Action
{ wch: 15 }, // Student ID
{ wch: 30 }, // Student Name
{ wch: 30 }  // Details
];

XLSX.utils.book_append_sheet(wb, wsActivity, 'Activity Log');

// Save Excel file
XLSX.writeFile(wb, `admin_${adminId}_report_${Date.now()}.xlsx`);
showAlert('Admin data exported to Excel successfully!');
};

const handleScroll = (e) => {
const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
if (scrollHeight - scrollTop <= clientHeight + 100) {
if (displayLimit < filteredStudents.length) setDisplayLimit(prev => prev + 20);
}
};

if (!adminProfile) return <LoginScreen onLogin={handleLogin} isLoading={loading} />;

return (
<div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
<Header adminName={adminProfile.name} onLogout={handleLogout} />

<div
className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth no-scrollbar"
onScroll={handleScroll}
>
{activeTab === 'admin' ? (
<AdminDashboard
admin={adminProfile}
allStudents={allStudents}
adminLogs={adminLogs}
adminList={adminList}
capturedCount={capturedCount}
isSuperAdmin={isSuperAdmin}
adminCaptureStats={adminCaptureStats}
onBlockAdmin={handleBlockAdmin}
onAddAdmin={() => setAddAdminState({ isOpen: true, adminId: '', adminName: '' })}
onViewAdminDetails={handleViewAdminDetails}
onDeletePhoto={handleDeletePhoto}
onExportAdminData={handleExportAdminData}
onExportAdminDataExcel={handleExportAdminDataExcel}
/>
) : activeTab === 'delete' ? (
<DeleteMode
students={visibleStudents}
viewMode={deleteViewMode}
setViewMode={setDeleteViewMode}
searchQuery={searchQuery}
setSearchQuery={(v) => { setSearchQuery(v); setDisplayLimit(20); }}
total={filteredStudents.length}
selectedImages={selectedImages}
toggleImageSelection={toggleImageSelection}
showBatchActions={showBatchActions}
onBatchDelete={handleBatchDelete}
onDeletePhoto={handleDeletePhoto}
/>
) : (
<div className="px-3 py-2 space-y-3">
<SearchBar
value={searchQuery}
onChange={(v) => { setSearchQuery(v); setDisplayLimit(20); }}
activeTab={activeTab}
count={filteredStudents.length}
/>

<div className="space-y-2 min-h-[50vh]">
{visibleStudents.map((student) => (
<StudentCard
key={student.id}
student={student}
mode={activeTab}
onCamera={() => setCameraState({ isOpen: true, studentId: student.id, studentName: student['ឈ្មោះ'] })}
onDelete={() => handleDeletePhoto(student.id)}
/>
))}

{visibleStudents.length === 0 && !loading && (
<div className="text-center py-12 text-slate-400 flex flex-col items-center">
<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
<Search className="h-6 w-6 text-slate-300" />
</div>
<p className="font-medium text-sm">រកមិនឃើញលទ្ធផល</p>
<p className="text-xs mt-1">សូមប្រែក្រមស្វ័យជ្រើសរើស</p>
</div>
)}

{displayLimit < filteredStudents.length && (
<div className="py-3 text-center">
<RefreshCw className="h-5 w-5 animate-spin text-indigo-500 mx-auto" />
</div>
)}
</div>
</div>
)}
</div>

<BottomNav 
activeTab={activeTab} 
onChange={setActiveTab} 
pendingCount={allStudents.filter(s => !s['រូបថត'] || s['រូបថត'] === 'n/a' || s['រូបថត'] === "").length} 
/>

{/* Overlays */}
{cameraState.isOpen && (
<CameraModal
studentName={cameraState.studentName}
onClose={() => setCameraState({ ...cameraState, isOpen: false })}
onCapture={(blob) => {
setCameraState({ ...cameraState, isOpen: false });
setPreviewState({ isOpen: true, blob, isUploading: false });
}}
/>
)}

{previewState.isOpen && (
<PreviewModal
blob={previewState.blob}
studentName={cameraState.studentName}
isUploading={previewState.isUploading}
onRetake={() => {
setPreviewState({ isOpen: false, blob: null, isUploading: false });
setCameraState({ ...cameraState, isOpen: true });
}}
onCancel={() => setPreviewState({ isOpen: false, blob: null, isUploading: false })}
onConfirm={async () => {
setPreviewState(prev => ({ ...prev, isUploading: true }));
try {
const formData = new FormData();
formData.append('file', previewState.blob);
formData.append('upload_preset', CLOUDINARY_PRESET);

const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
const data = await res.json();

if (data.secure_url) {
await update(ref(db, `students/${cameraState.studentId}`), { 'រូបថត': data.secure_url });
push(ref(db, `admin_logs/${adminProfile.id}`), {
action: 'UPLOAD_PHOTO',
studentId: cameraState.studentId,
timestamp: serverTimestamp()
});
setPreviewState({ isOpen: false, blob: null, isUploading: false });
showAlert('បញ្ចូលរូបភាពបានជោគជោគ!');
} else { throw new Error('Upload failed'); }
} catch (e) {
setPreviewState(prev => ({ ...prev, isUploading: false }));
showAlert('បរាប់ក្នុងការបញ្ចូល។ សូមព្យាយាមួយ។', 'error');
}
}}
/>
)}

{/* Add Admin Modal */}
{addAdminState.isOpen && (
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
<div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setAddAdminState({ isOpen: false, adminId: '', adminName: '' })}></div>
<div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl relative z-10 animate-scale-in">
<h3 className="text-xl font-bold text-slate-800 mb-4">បន្ថែមអ្នកគ្រប់គ្រងថ្មី</h3>
<div className="space-y-4">
<div>
<label className="block text-sm font-medium text-slate-700 mb-1">លេខនិស្សិត</label>
<input
type="text"
className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
placeholder="បញ្ចូលលេខនិស្សិត"
value={addAdminState.adminId}
onChange={e => setAddAdminState(prev => ({ ...prev, adminId: e.target.value }))}
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-700 mb-1">ឈ្មោះ</label>
<input
type="text"
className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
placeholder="បញ្ចូលឈ្មោះ"
value={addAdminState.adminName}
onChange={e => setAddAdminState(prev => ({ ...prev, adminName: e.target.value }))}
/>
</div>
</div>
<div className="flex gap-2 mt-6">
<button
onClick={() => setAddAdminState({ isOpen: false, adminId: '', adminName: '' })}
className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
>
បោះបង់
</button>
<button
onClick={handleAddAdmin}
className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
>
បន្ថែម
</button>
</div>
</div>
</div>
)}

{/* Admin Details Modal */}
{selectedAdminDetails && (
<AdminDetailsModal
admin={selectedAdminDetails}
allStudents={allStudents}
allAdminLogs={allAdminLogs}
onClose={() => setSelectedAdminDetails(null)}
onExport={() => handleExportAdminData(selectedAdminDetails.id)}
onExportExcel={() => handleExportAdminDataExcel(selectedAdminDetails.id)}
/>
)}

{/* Custom Modals */}
<AlertToast isOpen={alertState.isOpen} message={alertState.message} type={alertState.type} />
<ConfirmModal
isOpen={confirmState.isOpen}
title={confirmState.title}
message={confirmState.message}
onConfirm={confirmState.onConfirm}
onCancel={() => setConfirmState({ isOpen: false, title: '', message: '', onConfirm: null })}
/>
</div>
);
}

// --- Components ---

const LoginScreen = ({ onLogin, isLoading }) => {
const [val, setVal] = useState('');
const [isFocused, setIsFocused] = useState(false);

return (
<div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
{/* Background decorative elements */}
<div className="absolute top-0 left-0 w-full h-full overflow-hidden">
<div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
<div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
</div>

<div className="w-full max-w-md relative z-10">
{/* Main login card */}
<div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 relative overflow-hidden">
{/* Top gradient line */}
<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

{/* Logo and title section */}
<div className="text-center mb-8">
<div className="relative inline-block mb-6">
{/* Logo with glow effect */}
<div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-300">
<img src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png" alt="Logo" className="w-full h-full object-cover" />
</div>
{/* Glow effect behind logo */}
<div className="absolute inset-0 w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl blur-xl opacity-50 -z-10"></div>
</div>

<h1 className="text-3xl font-bold text-white mb-2">គ្រប់គ្រងទិន្នន័យរូបភាព</h1>
<p className="text-indigo-200 text-sm font-medium">ប្រព័ន្ធគ្រប់គ្រងទិន្នន័យនិស្សិត</p>
</div>

{/* Login form */}
<form onSubmit={(e) => { e.preventDefault(); onLogin(val); }} className="space-y-6">
<div className="relative">
<label className="block text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">លេខអ្នកគ្រប់គ្រង</label>
<div className={`relative transition-all duration-300 ${isFocused ? 'transform -translate-y-1' : ''}`}>
<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
<ShieldCheck className={`h-5 w-5 transition-colors duration-300 ${isFocused ? 'text-indigo-400' : 'text-indigo-300'}`} />
</div>
<input
type="text"
className={`w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 backdrop-blur-sm border text-white placeholder-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:bg-white/15 transition-all font-bold text-center text-lg tracking-widest ${
isFocused ? 'border-indigo-400' : 'border-white/20'
}`}
placeholder="បញ្ចូលលេខ"
value={val}
onChange={e => setVal(e.target.value)}
onFocus={() => setIsFocused(true)}
onBlur={() => setIsFocused(false)}
disabled={isLoading}
/>
{val && (
<button
type="button"
onClick={() => setVal('')}
className="absolute inset-y-0 right-0 pr-4 flex items-center text-indigo-300 hover:text-white transition-colors"
>
<X className="h-5 w-5" />
</button>
)}
</div>
</div>

<button
type="submit"
disabled={isLoading || !val}
className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
>
<span className="relative z-10 flex items-center justify-center gap-2">
{isLoading ? (
<>
<RefreshCw className="h-5 w-5 animate-spin" />
<span>កំពុងផ្ទៀង...</span>
</>
) : (
<>
<ShieldCheck className="h-5 w-5" />
<span>ចូលចូល</span>
</>
)}
</span>
{/* Button shine effect */}
<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
</button>
</form>

{/* Footer info */}
<div className="mt-8 pt-6 border-t border-white/10">
<div className="flex items-center justify-center gap-2 text-indigo-200 text-xs">
<Shield className="h-3 w-3" />
<span>ចូលចូលអ្នកគ្រប់គ្រង</span>
</div>
<p className="text-center text-indigo-300/70 text-xs mt-2">
សម្រាប់បុគ្គលិកដែលមានសិទ្ធិត្រឹមត្រូវ
</p>
</div>
</div>
</div>
</div>
);
};

const Header = ({ adminName, onLogout }) => (
<header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg z-30 sticky top-0">
<div className="px-3 py-2 flex items-center justify-between">
<div className="flex items-center gap-2">
<div className="w-8 h-8 rounded-lg overflow-hidden shadow-lg">
<img src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png" alt="Logo" className="w-full h-full object-cover" />
</div>
<div>
<h1 className="font-bold text-white leading-none text-sm">គ្រប់គ្រងទិន្នន័យរូបភាព</h1>
<p className="text-xs text-indigo-100 font-bold uppercase tracking-wider mt-0.5">អ្នកគ្រប់គ្រង: {adminName}</p>
</div>
</div>
<button onClick={onLogout} className="w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-lg flex items-center justify-center transition-all backdrop-blur-sm">
<LogOut className="h-4 w-4" />
</button>
</div>
</header>
);

const SearchBar = ({ value, onChange, activeTab, count }) => (
<div className="sticky top-0 z-20 pt-1 pb-2 bg-slate-50/95 backdrop-blur-sm">
<div className="relative group">
<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
</div>
<input
type="text"
className="block w-full pl-10 pr-8 py-2.5 border-none rounded-xl bg-white shadow-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-sm"
placeholder={
activeTab === 'home' ? "ស្វែងរកតាមលេខ ឬ ឈ្មោះ..." :
activeTab === 'pending' ? "ជ្រើសរើសនិស្សិតដែលមិនទាន់មាន..." :
"ស្វែងរករូបភាពដែលត្រូវលុប..."
}
value={value}
onChange={(e) => onChange(e.target.value)}
/>
{value && (
<button onClick={() => onChange('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-300 hover:text-slate-600">
<X className="h-4 w-4" />
</button>
)}
</div>
<div className="flex justify-between items-center mt-2 px-1">
<div className="flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{count} និស្សិត</span>
</div>
{activeTab !== 'home' && (
<span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
activeTab === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
}`}>
{activeTab === 'pending' ? 'រូបភាពខ្វះ' : 'លុបរូបភាព'}
</span>
)}
</div>
</div>
);

const StudentCard = ({ student, mode, onCamera, onDelete }) => {
const hasImage = student['រូបថត'] && student['រូបថត'] !== 'n/a' && student['រូបថត'] !== "";

return (
<div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center gap-3 animate-slide-up hover:shadow-md transition-all">
<div className="relative shrink-0">
{hasImage ? (
<div className="w-12 h-12 rounded-xl p-0.5 bg-gradient-to-tr from-green-400 to-emerald-600 shadow-sm">
<img src={student['រូបថត']} alt="Student" className="w-full h-full object-cover rounded-lg border border-white" />
</div>
) : (
<div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-300">
<User className="h-5 w-5" />
</div>
)}
<div className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shadow-sm">
{student.id}
</div>
</div>

<div className="flex-1 min-w-0 py-0.5">
<h3 className="font-bold text-slate-800 truncate text-base">
{student['ឈ្មោះ'] || "មិនស្គាលឈ្មោះ"}
</h3>
<p className="text-xs text-slate-500 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded truncate max-w-full">
{student['ជំនាញ'] || "និស្សិតទូទៅ"}
</p>
</div>

<div className="flex items-center">
{mode === 'home' && !hasImage && (
<button onClick={onCamera} className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Camera className="h-4 w-4" />
</button>
)}
{mode === 'pending' && (
<button onClick={onCamera} className="h-9 px-3 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-1">
<Camera className="h-3.5 w-3.5" />
<span>ថត</span>
</button>
)}
{mode === 'delete' && hasImage && (
<button onClick={onDelete} className="w-9 h-9 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
<Trash2 className="h-4 w-4" />
</button>
)}
</div>
</div>
);
};

const DeleteMode = ({
students,
viewMode,
setViewMode,
searchQuery,
setSearchQuery,
total,
selectedImages,
toggleImageSelection,
showBatchActions,
onBatchDelete,
onDeletePhoto
}) => {
return (
<div className="px-3 py-2 space-y-3">
{/* Header with controls */}
<div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-2">
<div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
<Database className="h-4 w-4 text-red-600" />
</div>
<div>
<h2 className="font-bold text-slate-800 text-sm">គ្រប់គ្រងរូបភាព</h2>
<p className="text-xs text-slate-500">តែបញ្ចូលតាមប្រព័ន្ធ</p>
</div>
</div>

<div className="flex items-center gap-1">
<button
onClick={() => setViewMode('grid')}
className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
>
<Grid3X3 className="h-3.5 w-3.5" />
</button>
<button
onClick={() => setViewMode('list')}
className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
>
<List className="h-3.5 w-3.5" />
</button>
</div>
</div>

{/* Search bar */}
<div className="mt-3 relative group">
<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
</div>
<input
type="text"
className="block w-full pl-9 pr-8 py-2 border-none rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-sm"
placeholder="ស្វែងរកតាមលេខ ឬ ឈ្មោះ..."
value={searchQuery}
onChange={(e) => setSearchQuery(e.target.value)}
/>
{searchQuery && (
<button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-300 hover:text-slate-600">
<X className="h-4 w-4" />
</button>
)}
</div>

{/* Stats */}
<div className="mt-3 flex items-center justify-between">
<div className="flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{total} រូបភាព</span>
</div>
<div className="flex items-center gap-1">
<span className="text-xs text-slate-500">ជ្រើសរើស:</span>
<span className="text-sm font-bold text-indigo-600">{selectedImages.size}</span>
</div>
</div>
</div>

{/* Batch actions bar */}
{showBatchActions && (
<div className="bg-indigo-600 text-white rounded-lg p-2.5 flex items-center justify-between animate-slide-up">
<div className="flex items-center gap-2">
<Shield className="h-4 w-4" />
<span className="text-xs font-medium">ជ្រើសរើស {selectedImages.size}</span>
</div>
<div className="flex items-center gap-1.5">
<button
onClick={() => setSelectedImages(new Set())}
className="px-2 py-1 bg-white/20 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
>
បោះបង់
</button>
<button
onClick={onBatchDelete}
className="px-2 py-1 bg-red-500 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
>
<Trash2 className="h-3 w-3" />
លុប
</button>
</div>
</div>
)}

{/* Content area */}
{viewMode === 'grid' ? (
<div className="grid grid-cols-3 gap-2">
{students.map((student) => (
<DeleteImageCard
key={student.id}
student={student}
isSelected={selectedImages.has(student.id)}
onSelect={() => toggleImageSelection(student.id)}
onDelete={() => onDeletePhoto(student.id)}
/>
))}
</div>
) : (
<div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
<div className="divide-y divide-slate-100">
{students.map((student) => (
<DeleteImageListItem
key={student.id}
student={student}
isSelected={selectedImages.has(student.id)}
onSelect={() => toggleImageSelection(student.id)}
onDelete={() => onDeletePhoto(student.id)}
/>
))}
</div>
</div>
)}

{/* Empty state */}
{students.length === 0 && (
<div className="text-center py-12 text-slate-400 flex flex-col items-center">
<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
<ImageOff className="h-6 w-6 text-slate-300" />
</div>
<p className="font-medium text-sm">រកមិនឃើញរូបភាព</p>
<p className="text-xs mt-1">តែបញ្ចូលតាមប្រព័ន្ធតែប៉ុណ្ណោះ</p>
</div>
)}
</div>
);
};

const DeleteImageCard = ({ student, isSelected, onSelect, onDelete }) => {
return (
<div className={`relative group rounded-lg overflow-hidden shadow-sm border-2 transition-all ${
isSelected ? 'border-indigo-500 shadow-md' : 'border-transparent hover:border-slate-200'
}`}>
{/* Selection overlay */}
<div
className={`absolute inset-0 bg-indigo-500/20 z-10 flex items-center justify-center transition-opacity ${
isSelected ? 'opacity-100' : 'opacity-0'
}`}
onClick={onSelect}
>
<div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
<CheckCircle2 className="h-5 w-5 text-indigo-600" />
</div>
</div>

{/* Image */}
<div className="aspect-square bg-slate-100 relative">
<img
src={student['រូបថត']}
alt={student['ឈ្មោះ']}
className="w-full h-full object-cover"
/>

{/* ID badge */}
<div className="absolute top-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
{student.id}
</div>

{/* Delete button */}
<button
onClick={onDelete}
className="absolute bottom-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
>
<Trash2 className="h-3 w-3" />
</button>
</div>

{/* Info */}
<div className="p-2 bg-white">
<h3 className="font-medium text-slate-800 truncate text-xs">{student['ឈ្មោះ']}</h3>
</div>

{/* Selection checkbox */}
<button
onClick={onSelect}
className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md z-20"
>
{isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />}
</button>
</div>
);
};

const DeleteImageListItem = ({ student, isSelected, onSelect, onDelete }) => {
return (
<div className={`p-3 flex items-center gap-3 transition-colors ${
isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
}`}>
{/* Selection checkbox */}
<button
onClick={onSelect}
className="w-4 h-4 rounded border-2 border-slate-300 flex items-center justify-center"
>
{isSelected && <CheckCircle2 className="h-3 w-3 text-indigo-600" />}
</button>

{/* Image */}
<div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
<img
src={student['រូបថត']}
alt={student['ឈ្មោះ']}
className="w-full h-full object-cover"
/>
</div>

{/* Info */}
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2 mb-1">
<h3 className="font-medium text-slate-800 truncate text-sm">{student['ឈ្មោះ']}</h3>
<span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{student.id}</span>
</div>
<p className="text-xs text-indigo-600 flex items-center gap-1">
<Clock className="h-2.5 w-2.5" />
បញ្ចូលតាមប្រព័ន្ធ
</p>
</div>

{/* Actions */}
<button
onClick={onDelete}
className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
>
<Trash2 className="h-3.5 w-3.5" />
</button>
</div>
);
};

const AdminDashboard = ({ admin, allStudents, adminLogs, adminList, capturedCount, isSuperAdmin, adminCaptureStats, onBlockAdmin, onAddAdmin, onViewAdminDetails, onDeletePhoto, onExportAdminData, onExportAdminDataExcel }) => {
// Stats calculation
const totalStudents = allStudents.length;
const completionRate = Math.round((capturedCount / totalStudents) * 100) || 0;

// Get only upload logs and limit to recent ones
const uploadLogs = adminLogs.filter(log => log.action === 'UPLOAD_PHOTO').slice(0, 8);

// Function to format timestamp
const formatTimestamp = (timestamp) => {
if (!timestamp) return 'មិនស្គាលពេល';
const date = new Date(timestamp);
return date.toLocaleString('km-KH', {
month: 'short',
day: 'numeric',
hour: '2-digit',
minute: '2-digit'
});
};

return (
<div className="px-3 py-2 space-y-4">
{/* Header Card with Logo */}
<div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-lg">
<div className="relative z-10">
<div className="flex items-center gap-3 mb-4">
<div className="w-14 h-14 rounded-lg overflow-hidden shadow-lg">
<img src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png" alt="Logo" className="w-full h-full object-cover" />
</div>
<div>
<p className="text-indigo-100 text-sm font-bold uppercase tracking-wider">ផ្ទាំងអ្នកគ្រប់គ្រង</p>
<h2 className="text-xl font-bold">គ្រប់គ្រងទិន្នន័យរូបភាព</h2>
<p className="text-indigo-200 text-sm">សូមត្រឡប់មកវិញ, {admin.name}</p>
</div>
</div>

<div className="grid grid-cols-3 gap-2">
<div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5 text-center">
<p className="text-indigo-100 text-[9px] font-bold uppercase">សរុប</p>
<p className="text-2xl font-bold mt-1">{totalStudents}</p>
</div>
<div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5 text-center">
<p className="text-indigo-100 text-[9px] font-bold uppercase">បានថត</p>
<p className="text-2xl font-bold mt-1">{capturedCount}</p>
</div>
<div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5 text-center">
<p className="text-indigo-100 text-[9px] font-bold uppercase">រួច</p>
<p className="text-2xl font-bold mt-1">{completionRate}%</p>
</div>
</div>
</div>
</div>

{/* Admin Statistics - Only for SuperAdmin */}
{isSuperAdmin && (
<div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
<div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-100">
<h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
<BarChart3 className="h-4 w-4 text-indigo-600" />
ស្ថនភាពអ្នកគ្រប់គ្រង
</h3>
</div>

<div className="p-4">
<div className="space-y-3">
{adminCaptureStats.map((stat) => (
<div key={stat.adminId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
onClick={() => onViewAdminDetails(stat.adminId)}>
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
<User className="h-5 w-5 text-indigo-600" />
</div>
<div className="flex-1 min-w-0">
<h4 className="font-medium text-slate-800 text-sm">{stat.name}</h4>
<span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{stat.adminId}</span>
</div>
</div>
<div className="text-right">
<div className="flex items-center gap-2 mb-1">
<span className="text-xs text-slate-500">បញ្ចូល:</span>
<span className="text-lg font-bold text-indigo-600">{stat.uploadCount}</span>
</div>
<div className="flex items-center gap-2">
<span className="text-xs text-slate-500">លុប:</span>
<span className="text-lg font-bold text-red-500">{stat.deleteCount}</span>
</div>
{stat.lastUpload && (
<p className="text-xs text-slate-400 mt-1">
{formatTimestamp(stat.lastUpload)}
</p>
)}
</div>
<div className="flex gap-1">
<button
onClick={(e) => {
e.stopPropagation();
onExportAdminData(stat.adminId);
}}
className="px-2 py-1 bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
title="Export as PDF"
>
<FileText className="h-4 w-4" />
</button>
<button
onClick={(e) => {
e.stopPropagation();
onExportAdminDataExcel(stat.adminId);
}}
className="px-2 py-1 bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
title="Export as Excel"
>
<Download className="h-4 w-4" />
</button>
</div>
</div>
))}
</div>
</div>
</div>
)}

{/* Admins Section - Only for SuperAdmin */}
{isSuperAdmin && (
<div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
<div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
<h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
<Users className="h-4 w-4 text-indigo-600" />
អ្នកគ្រប់គ្រង ({adminList.length})
</h3>
<button
onClick={onAddAdmin}
className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
>
<UserPlus className="h-3 w-3" />
បន្ថែម
</button>
</div>

<div className="divide-y divide-slate-100">
{adminList.map((admin) => (
<div key={admin.id} className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
<div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
<User className="h-5 w-5 text-indigo-600" />
</div>
<div className="flex-1 min-w-0">
<h4 className="font-medium text-slate-800 text-sm">{admin.name}</h4>
<span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{admin.id}</span>
</div>
<div className="flex items-center gap-2">
<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
admin.isBlocked
? 'bg-red-100 text-red-700'
: 'bg-green-100 text-green-700'
}`}>
{admin.isBlocked ? 'បិទ' : 'សកម្ម'}
</span>
{admin.id !== '250' && (
<button
onClick={() => onBlockAdmin(admin.id, admin.isBlocked)}
className={`text-xs font-medium hover:underline flex items-center gap-1 ${
admin.isBlocked ? 'text-green-600' : 'text-red-600'
}`}
>
{admin.isBlocked ? (
<>
<Unlock className="h-3 w-3" />
អនុញ្ញាត
</>
) : (
<>
<Lock className="h-3 w-3" />
ដោះទ្រា
</>
)}
</button>
)}
</div>
</div>
))}
</div>
</div>
)}

{/* Recent Captures Section */}
<div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
<div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-100">
<h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
<CameraIcon className="h-4 w-4 text-indigo-600" />
ថតថ្មីៗ
</h3>
</div>

{uploadLogs.length > 0 ? (
<div className="divide-y divide-slate-100">
{uploadLogs.map((log) => {
const student = allStudents.find(s => s.id === log.studentId);
if (!student) return null;

return (
<div key={log.id} className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
<div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
{student['រូបថត'] ? (
<img src={student['រូបថត']} className="w-full h-full object-cover" />
) : (
<User className="w-full h-full p-2.5 text-slate-300" />
)}
</div>
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2 mb-1">
<h4 className="font-medium text-slate-800 text-sm">{student['ឈ្មោះ']}</h4>
<span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{student.id}</span>
</div>
<div className="flex items-center gap-2 text-xs text-slate-500">
<Clock className="h-2.5 w-2.5" />
<span>{formatTimestamp(log.timestamp)}</span>
</div>
</div>
<button
onClick={() => onDeletePhoto(student.id)}
className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
>
<Trash2 className="h-3.5 w-3.5" />
</button>
</div>
);
})}
</div>
) : (
<div className="p-6 text-center text-slate-400">
<CameraIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
<p className="font-medium text-sm">មិនទាន់មានការថត</p>
<p className="text-xs mt-1">ការថតថ្មីៗរបស់អ្នកនឹងនឹងបង្ហាញនៅទីនេះ</p>
</div>
)}
</div>
</div>
);
};

// Updated CameraModal with simplified square viewfinder and no mirroring by default
const CameraModal = ({ onClose, onCapture, studentName }) => {
const videoRef = useRef(null);
const [stream, setStream] = useState(null);
const [isMirrored, setIsMirrored] = useState(false); // Changed to false by default

useEffect(() => {
navigator.mediaDevices.getUserMedia({
video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } }
}).then(s => {
setStream(s);
if (videoRef.current) videoRef.current.srcObject = s;
});
return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
}, []);

const takePicture = () => {
if (!videoRef.current) return;
const canvas = document.createElement('canvas');
const video = videoRef.current;
const size = Math.min(video.videoWidth, video.videoHeight);
canvas.width = size;
canvas.height = size;
const ctx = canvas.getContext('2d');

// Apply mirror if active
if (isMirrored) {
ctx.translate(size, 0);
ctx.scale(-1, 1);
}

// Calculate the square dimensions (75% of the smaller dimension)
const squareSize = size * 0.75;
const offset = (size - squareSize) / 2;

// Draw only the square area from the video
ctx.drawImage(
video,
offset, offset, squareSize, squareSize,  // Source rectangle
0, 0, squareSize, squareSize      // Destination rectangle
);

canvas.toBlob(blob => onCapture(blob), 'image/jpeg', 0.85);
};

return (
<div className="fixed inset-0 bg-black z-50 flex flex-col animate-scale-in">
<div className="flex justify-between items-center p-4 text-white z-10">
<div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
<p className="font-bold text-sm">{studentName}</p>
</div>
<button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20">
<X className="h-4 w-4 text-slate-600" />
</button>
</div>

<div className="flex-1 relative flex items-center justify-center overflow-hidden">
<video
ref={videoRef}
autoPlay
playsInline
className={`absolute w-full h-full object-cover transition-transform duration-300 ${isMirrored ? 'scale-x-[-1]' : ''}`}
/>

{/* Simplified square viewfinder */}
<div className="absolute inset-0 pointer-events-none flex items-center justify-center">
<div className="w-[75%] aspect-square border-2 border-white"></div>
</div>
</div>

<div className="h-28 bg-black flex items-center justify-around px-8">
<button
onClick={() => setIsMirrored(!isMirrored)}
className={`p-3 rounded-full transition-all ${isMirrored ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
>
<FlipHorizontal className="h-5 w-5" />
</button>

<button
onClick={takePicture}
className="w-16 h-16 rounded-full bg-white border-4 border-zinc-200 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-90 transition-transform"
>
<div className="w-12 h-12 bg-white rounded-full border border-zinc-300"></div>
</button>

<div className="w-12"></div> {/* Spacer for balance */}
</div>
</div>
);
};

// Updated PreviewModal with full-screen image display
const PreviewModal = ({ blob, studentName, isUploading, onRetake, onConfirm, onCancel }) => {
const url = useMemo(() => URL.createObjectURL(blob), [blob]);
const [isFullscreen, setIsFullscreen] = useState(false);

return (
<div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-scale-in">
<div className={`bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ${
isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-md max-h-[90vh]'
}`}>
<div className={`relative bg-black ${isFullscreen ? 'flex-1' : 'aspect-square'}`}>
<img 
    src={url} 
    alt="Preview" 
    className={`w-full h-full object-contain cursor-pointer transition-transform duration-300 ${isFullscreen ? '' : 'hover:scale-105'}`}
    onClick={() => setIsFullscreen(!isFullscreen)}
/>
{!isUploading && (
<button 
    onClick={onCancel} 
    className="absolute top-3 right-3 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors z-10"
>
<X className="h-4 w-4" />
</button>
)}
{!isFullscreen && (
<button
    onClick={() => setIsFullscreen(true)}
    className="absolute top-3 left-3 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors z-10"
>
<Expand className="h-4 w-4" />
</button>
)}
</div>
{!isFullscreen && (
<div className="p-4 space-y-4 bg-white">
<div className="text-center">
<p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">បញ្ជាក់ការបញ្ចូល</p>
<h3 className="font-bold text-lg text-slate-800">{studentName}</h3>
</div>
<div className="flex gap-2">
<button onClick={onRetake} disabled={isUploading} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors text-sm">
ថតម្តង
</button>
<button onClick={onConfirm} disabled={isUploading} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
{isUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
{isUploading ? "កំពុងបញ្ចូល..." : "បញ្ជាក់"}
</button>
</div>
</div>
)}
{isFullscreen && (
<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
<button onClick={onRetake} disabled={isUploading} className="px-4 py-2 bg-black/50 text-white rounded-lg backdrop-blur-md hover:bg-black/70 transition-colors text-sm">
ថតម្តង
</button>
<button onClick={onConfirm} disabled={isUploading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
{isUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
{isUploading ? "កំពុងបញ្ចូល..." : "បញ្ជាក់"}
</button>
</div>
)}
</div>
</div>
);
};

// Updated AdminDetailsModal with sorting and filtering options
const AdminDetailsModal = ({ admin, allStudents, allAdminLogs, onClose, onExport, onExportExcel }) => {
// State for sorting and filtering
const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
const [filterType, setFilterType] = useState('all'); // 'all', 'upload', 'delete'
const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'

// Get all logs for this admin
const adminLogs = useMemo(() => {
let logs = allAdminLogs.filter(log => log.adminId === admin.id);
  
  // Filter by action type
  if (filterType !== 'all') {
    logs = logs.filter(log => 
      filterType === 'upload' ? log.action === 'UPLOAD_PHOTO' : log.action === 'DELETE_PHOTO'
    );
  }
  
  // Filter by date
  const now = new Date();
  if (dateFilter === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    logs = logs.filter(log => {
      if (!log.timestamp) return false;
      const logDate = new Date(log.timestamp);
      return logDate >= today;
    });
  } else if (dateFilter === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    logs = logs.filter(log => {
      if (!log.timestamp) return false;
      const logDate = new Date(log.timestamp);
      return logDate >= weekAgo;
    });
  } else if (dateFilter === 'month') {
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    logs = logs.filter(log => {
      if (!log.timestamp) return false;
      const logDate = new Date(log.timestamp);
      return logDate >= monthAgo;
    });
  }
  
  // Sort by timestamp
  logs.sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return sortOrder === 'asc' 
      ? a.timestamp - b.timestamp 
      : b.timestamp - a.timestamp;
  });
  
  return logs;
}, [allAdminLogs, admin.id, filterType, dateFilter, sortOrder]);

// Get all photos uploaded by this admin
const uploadLogs = adminLogs.filter(log => log.action === 'UPLOAD_PHOTO');
const deleteLogs = adminLogs.filter(log => log.action === 'DELETE_PHOTO');

// Get all students with photos uploaded by this admin
const uploadedStudents = useMemo(() => {
  const students = allStudents.filter(student => {
    const studentUploadLogs = adminLogs.filter(log => log.studentId === student.id && log.action === 'UPLOAD_PHOTO');
    return studentUploadLogs.length > 0;
  });
  
  // Sort by upload date
  students.sort((a, b) => {
    const aLog = adminLogs.find(log => log.studentId === a.id && log.action === 'UPLOAD_PHOTO');
    const bLog = adminLogs.find(log => log.studentId === b.id && log.action === 'UPLOAD_PHOTO');
    
    if (!aLog || !aLog.timestamp) return 1;
    if (!bLog || !bLog.timestamp) return -1;
    
    return sortOrder === 'asc' 
      ? aLog.timestamp - bLog.timestamp 
      : bLog.timestamp - aLog.timestamp;
  });
  
  return students;
}, [allStudents, adminLogs, sortOrder]);

// Function to format timestamp
const formatTimestamp = (timestamp) => {
if (!timestamp) return 'មិនស្គាលពេល';
const date = new Date(timestamp);
return date.toLocaleString('km-KH', {
month: 'short',
day: 'numeric',
hour: '2-digit',
minute: '2-digit'
});
};

return (
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
<div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
<div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl relative z-10 animate-scale-in max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center mb-4">
<h3 className="text-xl font-bold text-slate-800">Admin Details</h3>
<button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors">
<X className="h-4 w-4 text-slate-600" />
</button>
</div>

<div className="space-y-4">
<div className="bg-slate-50 rounded-lg p-3">
<div className="flex items-center gap-3">
<div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
<User className="h-6 w-6 text-indigo-600" />
</div>
<div>
<h4 className="font-medium text-slate-800">{admin.name}</h4>
<span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">ID: {admin.id}</span>
</div>
</div>
</div>

<div className="bg-slate-50 rounded-lg p-3">
<h4 className="font-medium text-slate-800 mb-2">Statistics</h4>
<div className="grid grid-cols-2 gap-2">
<div className="bg-white rounded-lg p-2 text-center">
<p className="text-xs text-slate-500">Uploads</p>
<p className="text-lg font-bold text-indigo-600">{uploadLogs.length}</p>
</div>
<div className="bg-white rounded-lg p-2 text-center">
<p className="text-xs text-slate-500">Deletes</p>
<p className="text-lg font-bold text-red-500">{deleteLogs.length}</p>
</div>
</div>
<div className="mt-2 bg-white rounded-lg p-2 text-center">
<p className="text-xs text-slate-500">Students with Photos</p>
<p className="text-lg font-bold text-green-500">{uploadedStudents.length}</p>
</div>
</div>

<div className="bg-slate-50 rounded-lg p-3">
<div className="flex items-center justify-between mb-2">
<h4 className="font-medium text-slate-800">Recent Activities</h4>
<div className="flex gap-1">
{/* Sort button */}
<button
onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
className="p-1 bg-white rounded text-slate-500 hover:bg-slate-100 transition-colors"
title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
>
{sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
</button>
{/* Filter button */}
<div className="relative">
<button
className="p-1 bg-white rounded text-slate-500 hover:bg-slate-100 transition-colors"
title="Filter"
>
<Filter className="h-3 w-3" />
</button>
</div>
</div>
</div>

{/* Filter options */}
<div className="flex gap-2 mb-2">
<select
value={filterType}
onChange={(e) => setFilterType(e.target.value)}
className="text-xs bg-white border border-slate-200 rounded px-2 py-1"
>
<option value="all">All Actions</option>
<option value="upload">Uploads Only</option>
<option value="delete">Deletes Only</option>
</select>

<select
value={dateFilter}
onChange={(e) => setDateFilter(e.target.value)}
className="text-xs bg-white border border-slate-200 rounded px-2 py-1"
>
<option value="all">All Time</option>
<option value="today">Today</option>
<option value="week">This Week</option>
<option value="month">This Month</option>
</select>
</div>

<div className="space-y-2 max-h-40 overflow-y-auto">
{adminLogs.slice(0, 10).map((log) => {
const student = allStudents.find(s => s.id === log.studentId);
const action = log.action === 'UPLOAD_PHOTO' ? 'Upload Photo' :
log.action === 'DELETE_PHOTO' ? 'Delete Photo' :
log.action === 'BATCH_DELETE_PHOTOS' ? `Batch Delete ${log.count} Photos` :
log.action;

return (
<div key={log.id} className="bg-white rounded-lg p-2 text-xs">
<div className="flex justify-between">
<span className="font-medium">{action}</span>
<span className="text-slate-500">{formatTimestamp(log.timestamp)}</span>
</div>
{student && <p className="text-slate-500 mt-1">{student['ឈ្មោះ']} ({student.id})</p>}
</div>
);
})}
</div>
</div>

<div className="flex gap-2">
<button
onClick={onExport}
className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
>
<FileText className="h-4 w-4" />
Export PDF
</button>
<button
onClick={onExportExcel}
className="flex-1 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
>
<Download className="h-4 w-4" />
Export Excel
</button>
</div>
</div>
</div>
</div>
);
};

// --- Custom Alert/Confirm UI ---

const AlertToast = ({ isOpen, message, type }) => {
if (!isOpen) return null;
return (
<div className="fixed top-0 left-0 w-full h-full pointer-events-none flex items-start justify-center pt-6 z-[100]">
<div className={`pointer-events-auto bg-white/90 backdrop-blur-md px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-slide-up border-l-4 ${
type === 'error' ? 'border-red-500 text-red-600' : 'border-green-500 text-green-700'
}`}>
{type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
<span className="font-bold text-xs shadow-sm">{message}</span>
</div>
</div>
);
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
if (!isOpen) return null;
return (
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
<div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onCancel}></div>
<div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl relative z-10 animate-scale-in text-center">
<div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
<AlertTriangle className="h-7 w-7" />
</div>
<h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
<p className="text-slate-500 text-sm mb-5 leading-relaxed">{message}</p>
<div className="flex gap-2">
<button
onClick={onCancel}
className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
>
បោះបង់
</button>
<button
onClick={onConfirm}
className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
>
បញ្ជាក់
</button>
</div>
</div>
</div>
);
};

// --- Bottom Navigation ---
const BottomNav = ({ activeTab, onChange, pendingCount }) => {
const tabs = [
{ id: 'home', icon: Search, label: 'ស្វែងរក' },
{ id: 'pending', icon: ImageOff, label: 'ខ្វះ', badge: pendingCount },
{ id: 'delete', icon: Trash2, label: 'លុប' },
{ id: 'admin', icon: User, label: 'អ្នកគ្រប់គ្រង' }
];
return (
<nav className="glass fixed bottom-0 w-full pb-safe z-40 border-t border-white/40">
<div className="flex justify-around items-center h-16 px-2">
{tabs.map(tab => {
const isActive = activeTab === tab.id;
const Icon = tab.icon;
return (
<button
key={tab.id}
onClick={() => onChange(tab.id)}
className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
}`}
>
<div className={`p-1.5 rounded-xl transition-all duration-300 ${
isActive ? 'bg-indigo-50 -translate-y-1 shadow-sm' : ''
}`}>
<Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
</div>
<span className={`text-[9px] font-bold mt-0.5 ${
isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
} transition-all absolute bottom-1`}>
{tab.label}
</span>
{tab.badge > 0 && (
<span className="absolute top-2 right-1/4 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border border-white shadow-sm animate-pulse">
{tab.badge > 99 ? '99+' : tab.badge}
</span>
)}
</button>
);
})}
</div>
</nav>
);
};

// --- Mount application
const rootElement = document.getElementById('root');
if (rootElement) {
const root = createRoot(rootElement);
root.render(<App />);
}
