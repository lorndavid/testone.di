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
    UserPlus, UserX, Lock, Unlock, BarChart3
} from 'lucide-react';

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
    const [displayLimit, setDisplayLimit] = useState(20); // Changed to 20 as requested
    
    // Feature States
    const [cameraState, setCameraState] = useState({ isOpen: false, studentId: null, studentName: null });
    const [previewState, setPreviewState] = useState({ isOpen: false, blob: null, isUploading: false });
    
    // Custom Modal States
    const [alertState, setAlertState] = useState({ isOpen: false, message: '', type: 'success' });
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [addAdminState, setAddAdminState] = useState({ isOpen: false, adminId: '', adminName: '' });
    
    // Delete tab specific states
    const [deleteViewMode, setDeleteViewMode] = useState('grid');
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [showBatchActions, setShowBatchActions] = useState(false);

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

    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            if (displayLimit < filteredStudents.length) setDisplayLimit(prev => prev + 20); // Increased to 20 as requested
        }
    };

    if (!adminProfile) return <LoginScreen onLogin={handleLogin} isLoading={loading} />;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
            <Header adminName={adminProfile.name} onLogout={handleLogout} />

            <div 
                className="flex-1 overflow-y-auto overflow-x-hidden pb-20 scroll-smooth no-scrollbar"
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
                        onDeletePhoto={handleDeletePhoto}
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
                adminCaptureStats={adminCaptureStats}
                isSuperAdmin={isSuperAdmin}
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
                    <p className="text-[9px] text-indigo-100 font-bold uppercase tracking-wider mt-0.5">អ្នកគ្រប់គ្រង: {adminName}</p>
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
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{count} និស្សិត</span>
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
                    <button onClick={onCamera} className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                        <Camera className="h-4 w-4" />
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
                            <p className="text-[9px] text-slate-500">តែបញ្ចូលតាមប្រព័ន្ធ</p>
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
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{total} រូបភាព</span>
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

const AdminDashboard = ({ admin, allStudents, adminLogs, adminList, capturedCount, isSuperAdmin, adminCaptureStats, onBlockAdmin, onAddAdmin, onDeletePhoto }) => {
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
                                <div key={stat.adminId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <User className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-slate-800 text-sm">{stat.name}</h4>
                                            <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">ID: {stat.adminId}</span>
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
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-slate-800 text-sm">{admin.name}</h4>
                                        <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">ID: {admin.id}</span>
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
                                            <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">ID: {student.id}</span>
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

// --- Camera & Modal Components ---

const CameraModal = ({ onClose, onCapture, studentName }) => {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isMirrored, setIsMirrored] = useState(true);

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
        
        ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, size, size);
        canvas.toBlob(blob => onCapture(blob), 'image/jpeg', 0.85);
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col animate-scale-in">
            <div className="flex justify-between items-center p-4 text-white z-10">
                <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <p className="font-bold text-sm">{studentName}</p>
                </div>
                <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20">
                    <X className="h-4 w-4" />
                </button>
            </div>
            
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className={`absolute w-full h-full object-cover transition-transform duration-300 ${isMirrored ? 'scale-x-[-1]' : ''}`} 
                />
                
                {/* Guides */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[75%] aspect-square border-2 border-white/30 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                    </div>
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

const PreviewModal = ({ blob, studentName, isUploading, onRetake, onConfirm, onCancel }) => {
    const url = useMemo(() => URL.createObjectURL(blob), [blob]);
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-scale-in">
            <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="aspect-square bg-black relative">
                    <img src={url} alt="Preview" className="w-full h-full object-cover" />
                    {!isUploading && (
                        <button onClick={onCancel} className="absolute top-3 right-3 w-9 h-9 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <div className="p-4 space-y-4 bg-white">
                    <div className="text-center">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">បញ្ជាក់ការបញ្ចូល</p>
                        <h3 className="font-bold text-lg text-slate-800">{studentName}</h3>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onRetake} disabled={isUploading} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm">
                            ថតម្តង
                        </button>
                        <button onClick={onConfirm} disabled={isUploading} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 text-sm">
                            {isUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {isUploading ? "កំពុងបញ្ចូល..." : "បញ្ជាក់"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BottomNav = ({ activeTab, onChange, pendingCount, adminCaptureStats, isSuperAdmin }) => {
    const tabs = [
        { id: 'home', icon: Search, label: 'ស្វែងរក' },
        { id: 'pending', icon: ImageOff, label: 'ខ្វះ', badge: pendingCount },
        { id: 'delete', icon: Trash2, label: 'លុប' },
        { 
            id: 'admin', 
            icon: User, 
            label: 'អ្នកគ្រប់គ្រង',
            badge: isSuperAdmin ? adminCaptureStats.length : null
        },
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
                            className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-50 -translate-y-1 shadow-sm' : ''}`}>
                                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                            </div>
                            <span className={`text-[9px] font-bold mt-0.5 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all absolute bottom-1`}>
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

// --- Custom Alert/Confirm UI ---

const AlertToast = ({ isOpen, message, type }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none flex items-start justify-center pt-6 z-[100]">
            <div className={`pointer-events-auto bg-white/90 backdrop-blur-md px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-slide-up border-l-4 ${type === 'error' ? 'border-red-500 text-red-600' : 'border-green-500 text-green-700'}`}>
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
                        className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-sm"
                    >
                        បោះបង់
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-200 transition-colors text-sm"
                    >
                        បញ្ជាក់
                    </button>
                </div>
            </div>
        </div>
    );
};

// Mount the application
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}