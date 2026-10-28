'use strict';

// Mengelola state aplikasi menggunakan arsitektur sederhana
const AnimationController = {
    // Referensi ke elemen DOM
    scene: document.getElementById('sceneContainer'),
    buttons: {
        dance: document.getElementById('btnDance'),
        run: document.getElementById('btnRun'),
        jump: document.getElementById('btnJump')
    },
    
    // Daftar kelas mode yang tersedia
    modes: ['mode-dance', 'mode-run', 'mode-jump'],

    /**
     * Inisialisasi Event Listeners
     */
    init() {
        try {
            this.validateDOM();
            this.bindEvents();
            console.log("Animation Controller Initialized successfully.");
        } catch (error) {
            console.error("Initialization Failed:", error.message);
        }
    },

    /**
     * Validasi elemen DOM untuk menghindari error null reference
     */
    validateDOM() {
        if (!this.scene) throw new Error("Scene container tidak ditemukan.");
        if (!this.buttons.dance || !this.buttons.run || !this.buttons.jump) {
            throw new Error("Satu atau lebih tombol kontrol tidak ditemukan.");
        }
    },

    /**
     * Memasang event listener pada tombol kontrol
     */
    bindEvents() {
        this.buttons.dance.addEventListener('click', () => this.setMode('dance'));
        this.buttons.run.addEventListener('click', () => this.setMode('run'));
        this.buttons.jump.addEventListener('click', () => this.setMode('jump'));
    },

    /**
     * Mengatur mode animasi aktif dan membersihkan mode sebelumnya
     * @param {string} mode - Mode yang dipilih ('dance', 'run', 'jump')
     */
    setMode(mode) {
        // Reset seluruh kelas mode pada scene
        this.modes.forEach(m => this.scene.classList.remove(m));
        
        // Reset status tombol aktif
        Object.values(this.buttons).forEach(btn => btn.classList.remove('active'));

        // Menggunakan requestAnimationFrame untuk memastikan DOM repaint yang halus
        // sebelum menerapkan kelas animasi yang baru
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const targetClass = `mode-${mode}`;
                this.scene.classList.add(targetClass);
                
                // Tambahkan efek visual pada tombol yang ditekan
                if (this.buttons[mode]) {
                    this.buttons[mode].classList.add('active');
                }

                // Logika khusus: Untuk Jump, kembalikan ke state awal setelah animasi selesai (2 detik)
                if (mode === 'jump') {
                    this.handleJumpEnd();
                }
            });
        });
    },

    /**
     * Menangani penyelesaian animasi Jump
     */
    handleJumpEnd() {
        // Menghapus timer sebelumnya jika pengguna mengklik Jump berturut-turut
        if (this.jumpTimeout) clearTimeout(this.jumpTimeout);
        
        this.jumpTimeout = setTimeout(() => {
            this.scene.classList.remove('mode-jump');
            this.buttons.jump.classList.remove('active');
        }, 2000); // Sesuaikan dengan durasi CSS animasi jumpAction (2s)
    }
};

// Menjalankan controller setelah DOM dimuat sepenuhnya
document.addEventListener('DOMContentLoaded', () => {
    AnimationController.init();
});