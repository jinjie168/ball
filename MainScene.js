import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export default class MainScene {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        
        // --- 初始化核心組件 ---
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.composer = null;
        this.bloomPass = null;
        
        // --- 性能優化與自動降級狀態 ---
        this.isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
        this.useBloom = !this.isMobile; // 行動端默認禁用重度輝光
        this.fpsRecords = [];
        this.lastFrameTime = performance.now();
        this.fallbackTriggered = false;

        // --- 遊戲對象引用 ---
        this.playerBall = null; // 由外部邏輯注入
        this.arenaRadius = 100;

        this.init();
    }

    /**
     * 初始化 3D 場景與渲染管線
     */
    init() {
        // 1. 渲染器配置
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: !this.isMobile, // 行動端關閉原生抗鋸齒以提升效能
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // 2. 場景與相機
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.005);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 30, 50);

        // 3. 燈光系統
        this.initLighting();

        // 4. 環境建構 (碗狀競技場、霓虹網格、星空星系)
        this.createProceduralArena();
        this.createNeonGrid();
        this.createParticleGalaxy();

        // 5. 後期處理管線 (UnrealBloom)
        this.initPostProcessing();

        // 6. 事件監聽
        window.addEventListener('resize', () => this.onWindowResize());

        // 7. 啟動渲染循環
        this.animate();
    }

    /**
     * 初始化光影系統
     */
    initLighting() {
        // 全局環境光
        const ambientLight = new THREE.AmbientLight(0x1a1a3a, 0.6);
        this.scene.add(ambientLight);

        // 主方向光源 (帶有陰影投射)
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.dirLight.position.set(50, 80, 30);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = this.isMobile ? 1024 : 2048;
        this.dirLight.shadow.mapSize.height = this.isMobile ? 1024 : 2048;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 200;
        
        const d = 120;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);

        // 輔助裝飾光 (增加金屬質感立體感)
        const rimLight = new THREE.DirectionalLight(0x00ffff, 0.4);
        rimLight.position.set(-50, -20, -50);
        this.scene.add(rimLight);
    }

    /**
     * 程序化生成金屬碗狀競技場
     */
    createProceduralArena() {
        const segments = 64;
        const rings = 32;
        const geometry = new THREE.CylinderGeometry(this.arenaRadius, 0, 20, segments, rings, true);
        
        const position = geometry.attributes.position;

        // 修改頂點高度，使其形成底部平滑、邊緣陡峭的「碗狀」曲線 (二次方插值)
        for (let i = 0; i < position.count; i++) {
            let x = position.getX(i);
            let z = position.getZ(i);
            let r = Math.sqrt(x * x + z * z);
            
            // 使用歸一化半徑計算高度
            let normalizedRadius = r / this.arenaRadius;
            let y = Math.pow(normalizedRadius, 3) * 25; // 3次方讓邊緣更陡峭
            
            position.setY(i, y);
        }
        geometry.computeVertexNormals();

        // 建立高級金屬PBR材質
        this.arenaMaterial = new THREE.MeshStandardMaterial({
            color: 0x111525,
            metalness: 0.9,
            roughness: 0.2,
            side: THREE.DoubleSide
        });

        const arenaMesh = new THREE.Mesh(geometry, this.arenaMaterial);
        arenaMesh.receiveShadow = true;
        this.scene.add(arenaMesh);
    }

    /**
     * 創建發光的青色/綠色霓虹網格線
     */
    createNeonGrid() {
        // 使用自定義著色器材質，確保在沒有Bloom的情況下依然有自發光視覺效果
        this.gridMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(0x00ffcc) },
                uGlowIntensity: { value: 1.5 }
            },
            vertexShader: `
                varying vec3 vPosition;
                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uGlowIntensity;
                varying vec3 vPosition;
                void main() {
                    // 根據坐標強度模擬霓虹線條漸變
                    gl_FragColor = vec4(uColor * uGlowIntensity, 1.0);
                }
            `,
            wireframe: true,
            transparent: true,
            opacity: 0.4
        });

        // 稍微高於競技場表面以防止深度衝突(Z-fighting)
        const gridGeo = new THREE.PlaneGeometry(this.arenaRadius * 2, this.arenaRadius * 2, 40, 40);
        gridGeo.rotateX(-Math.PI / 2);
        
        // 調整網格頂點以貼合碗狀表面
        const pos = gridGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            let z = pos.getZ(i);
            let r = Math.sqrt(x * x + z * z);
            if (r <= this.arenaRadius) {
                let y = Math.pow(r / this.arenaRadius, 3) * 25 + 0.1;
                pos.setY(i, y);
            } else {
                pos.setY(i, 25.1); // 超出邊界平鋪
            }
        }
        gridGeo.computeVertexNormals();

        const grid = new THREE.Mesh(gridGeo, this.gridMaterial);
        this.scene.add(grid);
    }

    /**
     * 創建高級3D浮動粒子星系背景 (動態太空塵埃)
     */
    createParticleGalaxy() {
        const particleCount = this.isMobile ? 1000 : 3000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const colorSet = [new THREE.Color(0x00ffff), new THREE.Color(0xff00ff), new THREE.Color(0x3333ff)];

        for (let i = 0; i < particleCount; i++) {
            // 隨機分佈在廣闊的球體空間內
            const radius = 200 + Math.random() * 300;
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // 隨機分配星系顏色
            const chosenColor = colorSet[Math.floor(Math.random() * colorSet.length)];
            colors[i * 3] = chosenColor.r;
            colors[i * 3 + 1] = chosenColor.g;
            colors[i * 3 + 2] = chosenColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // 創建粒子材質 (圓點圓滑紋理)
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 16; pCanvas.height = 16;
        const ctx = pCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 16);
        const pTexture = new THREE.CanvasTexture(pCanvas);

        this.particleMaterial = new THREE.PointsMaterial({
            size: 2.5,
            map: pTexture,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.galaxyParticles = new THREE.Points(geometry, this.particleMaterial);
        this.scene.add(this.galaxyParticles);
    }

    /**
     * 初始化後期處理管線 (UnrealBloomPass)
     */
    initPostProcessing() {
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);

        // 初始化輝光濾鏡
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.2,  // 輝光強度
            0.4,  // 半徑
            0.85  // 閾值
        );
        this.composer.addPass(this.bloomPass);
    }

    /**
     * 動態動態相機差值器
     * @param {number} playerSize - 玩家當前的球體半徑/體積等級
     */
    updateCamera(playerSize) {
        if (!this.playerBall) return;

        const playerPos = this.playerBall.position;
        
        // 根據玩家大小動態計算動態縮放距離 (Majestic Tactical View)
        const targetDistance = 35 + playerSize * 5;
        const targetHeight = 25 + playerSize * 3;

        // 計算相機目標位置 (保持在玩家後上方)
        const targetCameraPos = new THREE.Vector3(
            playerPos.x,
            playerPos.y + targetHeight,
            playerPos.z + targetDistance
        );

        // 使用平滑線性插值 (LERP) 實現無縫運鏡
        this.camera.position.lerp(targetCameraPos, 0.05);
        this.camera.lookAt(playerPos.x, playerPos.y + (playerSize * 0.5), playerPos.z);
    }

    /**
     * 核心性能監控與防崩潰降級邏輯 (Anti-Crash Logic)
     */
    monitorPerformance(deltaTime) {
        if (this.fallbackTriggered) return;

        // 計算當前影格率
        const currentFps = 1000 / deltaTime;
        this.fpsRecords.push(currentFps);

        if (this.fpsRecords.length > 60) {
            this.fpsRecords.shift();
        }

        // 收集滿樣本後進行評估
        if (this.fpsRecords.length === 60) {
            const avgFps = this.fpsRecords.reduce((a, b) => a + b, 0) / 60;

            // 如果平均幀率低於 45 FPS，立即執行無縫降級
            if (avgFps < 45 && this.useBloom) {
                this.triggerHardwareFallback();
            }
        }
    }

    /**
     * 執行防崩潰降級：卸載Bloom，切換至高效能自發光材質
     */
    triggerHardwareFallback() {
        console.warn("Performance drop detected. Switching to High-Efficiency Emissive Material Fallback...");
        this.fallbackTriggered = true;
        this.useBloom = false;

        // 1. 提升環境光以補償失去 Bloom 的畫面亮度
        this.scene.ambientLight ? this.scene.ambientLight.intensity = 1.0 : null;

        // 2. 將霓虹材質降級或調整其 Uniform 自發光強度以防畫面變黑
        if (this.gridMaterial && this.gridMaterial.uniforms) {
            this.gridMaterial.uniforms.uGlowIntensity.value = 2.5; // 增強原色對比
        }

        // 3. 調整金屬球場反光度降低 GPU 著色壓力
        if (this.arenaMaterial) {
            this.arenaMaterial.roughness = 0.5; 
        }

        // 4. 清理並釋放 Composer 內存
        this.composer.passes = [];
    }

    /**
     * 設置當前追蹤的玩家球體 (由外部 Game 類調用)
     */
    setPlayerBall(ballMesh) {
        this.playerBall = ballMesh;
    }

    /**
     * 每影格動畫循環
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // 1. 性能檢測
        this.monitorPerformance(deltaTime);

        // 2. 太空塵埃粒子星系緩慢自轉與上下漂浮
        if (this.galaxyParticles) {
            this.galaxyParticles.rotation.y += 0.0005;
            this.galaxyParticles.rotation.x += 0.0002;
        }

        // 3. 獲取當前玩家尺寸並更新相機
        let playerSize = 1.0;
        if (this.playerBall) {
            // 假設球體使用了 scale 來代表成長
            playerSize = this.playerBall.scale.x;
            this.updateCamera(playerSize);
        }

        // 4. 渲染管線分支調度
        if (this.useBloom && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * 視窗大小自適應
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
}
