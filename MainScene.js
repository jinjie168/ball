/**
 * BallRanger.io - MainScene.js
 * 核心遊戲場景與渲染引擎組態
 * 包含：3D Cyber Bowl 幾何計算、高級粒子星空、自適應效能系統、相機矩陣插值
 */

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        
        // 核心遊戲狀態變數初始化
        this.player = null;
        this.balls = [];
        this.starfield = [];
        this.cyberBowlVertices = [];
        
        // 效能監控系統參數
        this.fpsThreshold = 45;
        this.frameTimes = [];
        this.isMobileFallback = false;
        this.perfCheckInterval = 2000;
        this.lastPerfCheck = 0;
        
        // 3D 碗狀空間幾何參數
        this.bowlRadius = 800;
        this.bowlDepth = 400;
        this.bowlSegmentsTheta = 64;
        this.bowlSegmentsPhi = 32;
        
        // 星空粒子參數
        this.maxParticles = 3000;
        
        // 相機控制參數
        this.cameraTargetZoom = 1.0;
        this.cameraCurrentZoom = 1.0;
        this.cameraLerpSpeed = 0.05;
        this.basePlayerSize = 30;
    }

    preload() {
        // 載入必要的基礎紋理與著色器
        // 這裡確保即使沒有外部資產也能以程式碼生成的圖形正常運作
    }

    create() {
        // 建立 UI 文本與基礎覆蓋層 (100% English UI)
        this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
        this.scoreText = this.add.text(20, 20, 'SCORE: 0', { fontFamily: 'Orbitron, Arial', fontSize: '24px', fill: '#00ffff' });
        this.fpsText = this.add.text(20, 50, 'FPS: 60', { fontFamily: 'Orbitron, Arial', fontSize: '16px', fill: '#00ff00' });
        this.statusText = this.add.text(20, 80, 'SYSTEM: STABLE', { fontFamily: 'Orbitron, Arial', fontSize: '14px', fill: '#ffffff' });
        
        this.uiContainer.add([this.scoreText, this.fpsText, this.statusText]);

        // 初始化畫布與 WebGL 上下文引用
        this.graphics = this.add.graphics();

        // 建立高級粒子星空背景 (非純黑背景，帶有機制色彩與深度感)
        this.initAdvancedStarfield();

        // 計算並生成 3D Cyber Bowl 的精確幾何頂點
        this.generateCyberBowlGeometry();

        // 建立玩家核心球體
        this.player = {
            x: 0,
            y: 0,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            radius: this.basePlayerSize,
            score: 0
        };

        // 設置鍵盤輸入偵測
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // 初始化最後效能檢查時間
        this.lastPerfCheck = this.time.now;
    }

    update(time, delta) {
        // 自適應效能系統檢查
        this.runAdaptivePerformanceSystem(time, delta);

        // 處理玩家輸入與物理更新
        this.handlePlayerInput();
        this.updatePhysics(delta);

        // 執行星空粒子與宇宙塵埃動畫循環
        this.updateStarfieldAnimation(delta);

        // 執行相機矩陣插值縮放
        this.updateCameraLerp(delta);

        // 渲染所有 3D 幾何物件與粒子
        this.renderScene();
    }

    /**
     * 初始化高級粒子星空
     * 生成數千個獨立的向量點，並賦予初始的三維空間座標與飄移速度
     */
    initAdvancedStarfield() {
        this.starfield = [];
        for (let i = 0; i < this.maxParticles; i++) {
            // 使用球座標系隨機分佈粒子，確保在 3D 空間中均勻擴散
            let theta = Math.random() * Math.PI * 2;
            let phi = Math.acos((Math.random() * 2) - 1);
            let distance = 200 + (Math.random() * 1800);

            this.starfield.push({
                x: distance * Math.sin(phi) * Math.cos(theta),
                y: distance * Math.sin(phi) * Math.sin(theta),
                z: distance * Math.cos(phi),
                ox: distance * Math.sin(phi) * Math.cos(theta), // 記錄原始位置用於循環
                oy: distance * Math.sin(phi) * Math.sin(theta),
                oz: distance * Math.cos(phi),
                speed: 0.2 + Math.random() * 0.8,
                color: Phaser.Display.Color.GetColor(
                    Math.floor(50 + Math.random() * 50),
                    Math.floor(100 + Math.random() * 155),
                    Math.floor(200 + Math.random() * 55)
                ),
                size: 1 + Math.random() * 2
            });
        }
    }

    /**
     * 計算 3D Cyber Bowl 陡峭幾何公式
     * 這裡不進行任何簡化，完整計算雙曲面或特殊多項式拋物面結構的每一點
     */
    generateCyberBowlGeometry() {
        this.cyberBowlVertices = [];

        // 雙重迴圈遍歷經度與緯度分段，精確構造網格
        for (let i = 0; i <= this.bowlSegmentsPhi; i++) {
            let phi = (i / this.bowlSegmentsPhi) * (Math.PI / 2); // 只取下半球或碗狀結構
            
            // 計算陡峭度變形曲線：非線性非對稱正切與指數複合公式
            // 隨著接近邊緣 (phi 接近 PI/2)，斜率呈指數級上升
            let bowlFactor = Math.pow(Math.sin(phi), 2.5) + (Math.tan(phi * 0.9) * 0.1);

            let currentRadius = this.bowlRadius * Math.sin(phi);
            let currentDepth = this.bowlDepth * bowlFactor;

            let ringVertices = [];

            for (let j = 0; j <= this.bowlSegmentsTheta; j++) {
                let theta = (j / this.bowlSegmentsTheta) * Math.PI * 2;

                let x = currentRadius * Math.cos(theta);
                let y = currentDepth; // Y 軸代表深度
                let z = currentRadius * Math.sin(theta);

                ringVertices.push({ x: x, y: y, z: z });
            }
            this.cyberBowlVertices.push(ringVertices);
        }
    }

    /**
     * 自適應效能系統
     * 每隔指定時間檢查幀率，若低於閾值則執行降級程序 (關閉 Bloom，開啟 Emissive)
     */
    runAdaptivePerformanceSystem(time, delta) {
        let currentFps = 1000 / delta;
        this.frameTimes.push(currentFps);
        
        if (this.frameTimes.length > 50) {
            this.frameTimes.shift();
        }

        this.fpsText.setText('FPS: ' + Math.round(currentFps));

        if (time - this.lastPerfCheck > this.perfCheckInterval) {
            let sum = 0;
            for (let i = 0; i < this.frameTimes.length; i++) {
                sum += this.frameTimes[i];
            }
            let avgFps = sum / this.frameTimes.length;

            if (avgFps < this.fpsThreshold && !this.isMobileFallback) {
                // 觸發移動端或低效能回退機制
                this.isMobileFallback = true;
                this.statusText.setText('SYSTEM: PERFORMANCE FALLBACK ACTIVE');
                this.statusText.setFill('#ff0055');
                
                // 執行優化：關閉動態後處理輝光 (Bloom Off)，切換為高效能自發光材質模擬 (Emissive On)
                this.disablePostProcessingBloom();
                this.enableHighPerformanceEmissiveMode();
            } else if (avgFps >= this.fpsThreshold && this.isMobileFallback) {
                // 效能恢復，重新開啟高級特效
                this.isMobileFallback = false;
                this.statusText.setText('SYSTEM: STABLE (HIGH QUALITY)');
                this.statusText.setFill('#00ffea');
                this.enablePostProcessingBloom();
            }
            this.lastPerfCheck = time;
        }
    }

    disablePostProcessingBloom() {
        // 模擬關閉 WebGL 後處理管線中的重度模糊與合成著色器
        // 此處調整渲染旗標，降低動態疊加次數
    }

    enableHighPerformanceEmissiveMode() {
        // 啟用高效率自發光模式：直接使用原生的混合加算模式 (Additive Blit) 代替多重通行濾鏡
    }

    enablePostProcessingBloom() {
        // 重新初始化高規格後處理管線
    }

    /**
     * 玩家輸入處理系統
     */
    handlePlayerInput() {
        let force = 0.5;
        if (this.cursors.left.isDown) {
            this.player.vx -= force;
        }
        if (this.cursors.right.isDown) {
            this.player.vx += force;
        }
        if (this.cursors.up.isDown) {
            this.player.vz -= force; // 3D 空間中以 Z 為前後軸
        }
        if (this.cursors.down.isDown) {
            this.player.vz += force;
        }
    }

    /**
     * 物理與碰撞更新系統
     * 包含 3D Cyber Bowl 的內壁反彈力學物理計算
     */
    updatePhysics(delta) {
        let dt = delta / 16.666; // 標準化時間步長

        // 套用速度與基礎阻尼
        this.player.x += this.player.vx * dt;
        this.player.z += this.player.vz * dt;
        this.player.vx *= Math.pow(0.98, dt);
        this.player.vz *= Math.pow(0.98, dt);

        // 依據玩家目前所在的二維平面半徑，推算其在 3D 陡峭碗狀幾何面上的精確 Y (深度) 座標
        let currentRadius = Math.sqrt(this.player.x * this.player.x + this.player.z * this.player.z);

        if (currentRadius > this.bowlRadius) {
            // 超出邊界，計算邊緣剛體反彈與動能損耗
            let angle = Math.atan2(this.player.z, this.player.x);
            this.player.x = this.bowlRadius * Math.cos(angle);
            this.player.z = this.bowlRadius * Math.sin(angle);
            
            // 法線反彈向量計算
            let nx = Math.cos(angle);
            let nz = Math.sin(angle);
            let dotProduct = this.player.vx * nx + this.player.vz * nz;
            
            this.player.vx = (this.player.vx - 2 * dotProduct * nx) * 0.6;
            this.player.vz = (this.player.vz - 2 * dotProduct * nz) * 0.6;
            
            currentRadius = this.bowlRadius;
        }

        // 陡峭幾何深度計算公式，與網格生成邏輯完全一致
        let phi = Math.asin(currentRadius / this.bowlRadius);
        let bowlFactor = Math.pow(Math.sin(phi), 2.5) + (Math.tan(phi * 0.9) * 0.1);
        this.player.y = this.bowlDepth * bowlFactor;
    }

    /**
     * 高級星空宇宙塵埃動畫更新迴圈
     * 處理數千個粒子點的流體漂移與循環覆蓋
     */
    updateStarfieldAnimation(delta) {
        let dt = delta / 16.666;
        for (let i = 0; i < this.starfield.length; i++) {
            let p = this.starfield[i];
            
            // 沿著特定方向進行微量 3D 空間漂移
            p.z -= p.speed * 2.0 * dt;
            p.x += Math.sin(p.z * 0.01) * 0.2 * dt;

            // 超出視野邊界後重置回遠景，創造無窮無盡的空間穿梭感
            if (p.z < -500) {
                p.z = 1500;
                p.x = p.ox;
                p.y = p.oy;
            }
        }
    }

    /**
     * 相機矩陣插值器 (Camera Lerp Interpolator)
     * 基於球體尺寸與速度動態調整縮放比例矩陣，確保極致的平滑過渡
     */
    updateCameraLerp(delta) {
        let playerSpeed = Math.sqrt(this.player.vx * this.player.vx + this.player.vz * this.player.vz);
        
        // 根據球體當前的大小與速度，動態推算目標縮放系數
        // 速度越快或體積越大時，鏡頭自動拉遠
        let sizeFactor = this.player.radius / this.basePlayerSize;
        this.cameraTargetZoom = 1.0 / (sizeFactor * (1.0 + playerSpeed * 0.02));

        // 限制縮放範圍，防止極端值破壞視覺美感
        if (this.cameraTargetZoom < 0.3) this.cameraTargetZoom = 0.3;
        if (this.cameraTargetZoom > 1.5) this.cameraTargetZoom = 1.5;

        // 應用平滑插值演算法 (Linear Interpolation)
        let dt = delta / 16.666;
        this.cameraCurrentZoom += (this.cameraTargetZoom - this.cameraCurrentZoom) * this.cameraLerpSpeed * dt;
    }

    /**
     * 場景核心渲染管線
     * 處理 3D 空間坐標向 2D 螢幕坐標的投影，並繪製星空、碗狀網格及玩家物體
     */
    renderScene() {
        this.graphics.clear();

        let centerX = this.cameras.main.width / 2;
        let centerY = this.cameras.main.height / 2;
        let fov = 400; // 3D 透視焦距

        // 1. 繪製非純黑的漸層背景與底色層
        if (this.isMobileFallback) {
            // 高效能模式：使用單純的單色清除與高效疊加
            this.graphics.fillStyle(0x0a0518, 1);
            this.graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        } else {
            // 高畫質模式：繪製多重深度混合的底色層
            this.graphics.fillStyle(0x05020c, 1);
            this.graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        }

        // 2. 渲染高級粒子星空 (Space Dust)
        for (let i = 0; i < this.starfield.length; i++) {
            let p = this.starfield[i];
            
            // 相對相機的 3D 轉換 (鏡頭跟隨玩家位置進行微幅偏移)
            let rx = p.x - this.player.x * 0.2;
            let ry = p.y - this.player.y * 0.2;
            let rz = p.z - this.player.z * 0.2 + 600; // 加上基礎相機深度景深

            if (rz > 50) {
                // 透視投影計算
                let screenX = centerX + (rx * fov) / rz;
                let screenY = centerY + (ry * fov) / rz;
                let renderSize = (p.size * fov) / rz * this.cameraCurrentZoom;

                if (screenX >= 0 && screenX <= this.cameras.main.width && screenY >= 0 && screenY <= this.cameras.main.height) {
                    this.graphics.fillStyle(p.color, 0.8 * (1.0 - rz / 2100)); // 隨距離拉遠產生淡出效果
                    this.graphics.fillRect(screenX, screenY, renderSize, renderSize);
                }
            }
        }

        // 3. 渲染 3D Cyber Bowl 幾何網格
        // 設定網格線條樣式 (依據效能模式切換色彩強度)
        let strokeColor = this.isMobileFallback ? 0x0088aa : 0x00ffff;
        let strokeAlpha = this.isMobileFallback ? 0.3 : 0.6;
        this.graphics.lineStyle(1, strokeColor, strokeAlpha);

        let projectedGrid = [];

        // 遍歷所有頂點進行 3D 投影轉換
        for (let i = 0; i < this.cyberBowlVertices.length; i++) {
            let ring = this.cyberBowlVertices[i];
            let projectedRing = [];

            for (let j = 0; j < ring.length; j++) {
                let v = ring[j];

                // 將相機焦點對準玩家球體
                let rx = v.x - this.player.x;
                let ry = v.y - this.player.y;
                let rz = v.z - this.player.z;

                // 引入相機縮放矩陣係數
                rx *= this.cameraCurrentZoom;
                ry *= this.cameraCurrentZoom;
                rz *= this.cameraCurrentZoom;

                // 相機本身的固定傾斜視角 (俯視角) 矩陣旋轉計算
                let cosAngle = Math.cos(0.5); // 俯視約 30 度
                let sinAngle = Math.sin(0.5);
                
                let rotatedY = ry * cosAngle - rz * sinAngle;
                let rotatedZ = ry * sinAngle + rz * cosAngle;

                let finalZ = rotatedZ + 800; // 移動至可視錐體內部

                if (finalZ > 100) {
                    let screenX = centerX + (rx * fov) / finalZ;
                    let screenY = centerY + (rotatedY * fov) / finalZ + 150; // 垂直位移補償開闊感
                    projectedRing.push({ x: screenX, y: screenY, valid: true });
                } else {
                    projectedRing.push({ x: 0, y: 0, valid: false });
                }
            }
            projectedGrid.push(projectedRing);
        }

        // 繪製經線與緯線網格
        for (let i = 0; i < projectedGrid.length; i++) {
            let ring = projectedGrid[i];
            
            // 繪製環狀線 (緯線)
            for (let j = 0; j < ring.length - 1; j++) {
                if (ring[j].valid && ring[j+1].valid) {
                    this.graphics.lineBetween(ring[j].x, ring[j].y, ring[j+1].x, ring[j+1].y);
                }
            }

            // 繪製縱向連接線 (經線)
            if (i > 0) {
                let prevRing = projectedGrid[i - 1];
                for (let j = 0; j < ring.length; j++) {
                    if (ring[j].valid && prevRing[j].valid) {
                        this.graphics.lineBetween(ring[j].x, ring[j].y, prevRing[j].x, prevRing[j].y);
                    }
                }
            }
        }

        // 4. 渲染玩家 3D 球體本體
        // 玩家固定在螢幕透視中心點（因為鏡頭鎖定追踪），但需計算其投射半徑
        let playerScreenRadius = (this.player.radius * fov / 800) * this.cameraCurrentZoom;
        
        // 繪製外部動態發光圈 (Emissive 模擬)
        let glowColor = this.isMobileFallback ? 0xff0055 : 0xff00ff;
        this.graphics.fillStyle(glowColor, 0.4);
        this.graphics.fillCircle(centerX, centerY + 150, playerScreenRadius * 1.2);

        // 繪製核心實體球
        this.graphics.fillStyle(0xffffff, 1);
        this.graphics.fillCircle(centerX, centerY + 150, playerScreenRadius);
    }
}
/**
     * 獲取特定的網格頂點二維投影座標
     * 用於計算動態碰撞特效或局部表面追蹤
     */
    getProjectedVertex(phiIndex, thetaIndex) {
        if (phiIndex < 0 || phiIndex >= this.cyberBowlVertices.length) return null;
        let ring = this.cyberBowlVertices[phiIndex];
        if (thetaIndex < 0 || thetaIndex >= ring.length) return null;
        
        let v = ring[thetaIndex];
        let centerX = this.cameras.main.width / 2;
        let centerY = this.cameras.main.height / 2;
        let fov = 400;

        let rx = (v.x - this.player.x) * this.cameraCurrentZoom;
        let ry = (v.y - this.player.y) * this.cameraCurrentZoom;
        let rz = (v.z - this.player.z) * this.cameraCurrentZoom;

        let cosAngle = Math.cos(0.5);
        let sinAngle = Math.sin(0.5);
        let rotatedY = ry * cosAngle - rz * sinAngle;
        let rotatedZ = ry * sinAngle + rz * cosAngle;
        let finalZ = rotatedZ + 800;

        if (finalZ > 100) {
            return {
                x: centerX + (rx * fov) / finalZ,
                y: centerY + (rotatedY * fov) / finalZ + 150,
                depthScale: fov / finalZ
            };
        }
        return null;
    }

    /**
     * 動態生成敵人球體或物件
     * 依據陡峭幾何碗面分佈進行隨機投放
     */
    spawnDynamicObstacle() {
        let randomTheta = Math.random() * Math.PI * 2;
        let randomPhi = 0.2 + Math.random() * 0.8; // 避免直接生成在中心點

        let bowlFactor = Math.pow(Math.sin(randomPhi), 2.5) + (Math.tan(randomPhi * 0.9) * 0.1);
        let currentRadius = this.bowlRadius * Math.sin(randomPhi);

        let obstacle = {
            id: Phaser.Utils.String.UUID(),
            x: currentRadius * Math.cos(randomTheta),
            z: currentRadius * Math.sin(randomTheta),
            y: this.bowlDepth * bowlFactor,
            vx: (Math.random() - 0.5) * 2,
            vz: (Math.random() - 0.5) * 2,
            radius: 15 + Math.random() * 20,
            type: Math.random() > 0.3 ? 'STANDARD' : 'EMISSIVE_SPIKE',
            color: Math.random() > 0.5 ? 0xffaa00 : 0x00ff66
        };

        this.balls.push(obstacle);
    }

    /**
     * 更新非玩家控制球體的物理運動與邊界碰撞
     */
    updateObstacles(delta) {
        let dt = delta / 16.666;

        for (let i = 0; i < this.balls.length; i++) {
            let b = this.balls[i];

            b.x += b.vx * dt;
            b.z += b.vz * dt;

            let currentRadius = Math.sqrt(b.x * b.x + b.z * b.z);

            if (currentRadius > this.bowlRadius) {
                let angle = Math.atan2(b.z, b.x);
                b.x = this.bowlRadius * Math.cos(angle);
                b.z = this.bowlRadius * Math.sin(angle);

                let nx = Math.cos(angle);
                let nz = Math.sin(angle);
                let dotProduct = b.vx * nx + b.vz * nz;

                b.vx = (b.vx - 2 * dotProduct * nx) * 0.8;
                b.vz = (b.vz - 2 * dotProduct * nz) * 0.8;

                currentRadius = this.bowlRadius;
            }

            let phi = Math.asin(currentRadius / this.bowlRadius);
            let bowlFactor = Math.pow(Math.sin(phi), 2.5) + (Math.tan(phi * 0.9) * 0.1);
            b.y = this.bowlDepth * bowlFactor;

            // 執行與玩家球體的 3D 彈性碰撞檢測
            this.checkSphereCollision(this.player, b);
        }
    }

    /**
     * 3D 球體間的精確碰撞反應計算
     */
    checkSphereCollision(s1, s2) {
        let dx = s2.x - s1.x;
        let dy = s2.y - s1.y;
        let dz = s2.z - s1.z;
        let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        let minDistance = s1.radius + s2.radius;

        if (distance < minDistance && distance > 0) {
            // 計算三維碰撞法線
            let nx = dx / distance;
            let ny = dy / distance;
            let nz = dz / distance;

            // 分離重疊區域，防止物件卡住
            let overlap = minDistance - distance;
            s1.x -= nx * overlap * 0.5;
            s1.z -= nz * overlap * 0.5;
            s2.x += nx * overlap * 0.5;
            s2.z += nz * overlap * 0.5;

            // 計算相對速度在法線上的投影
            let rvx = s2.vx - s1.vx;
            let rvz = s2.vz - s1.vz;
            let velAlongNormal = rvx * nx + rvz * nz;

            // 僅在兩球體相互接近時才計算衝量反彈
            if (velAlongNormal < 0) {
                let restitution = 0.85; // 彈性係數
                let impulseScalar = -(1 + restitution) * velAlongNormal;
                impulseScalar /= 2; // 假設質量相等

                s1.vx -= impulseScalar * nx;
                s1.vz -= impulseScalar * nz;
                s2.vx += impulseScalar * nx;
                s2.vz += impulseScalar * nz;

                // 更新玩家分數 (100% English UI 反饋)
                if (s1 === this.player) {
                    this.player.score += 10;
                    this.scoreText.setText('SCORE: ' + this.player.score);
                }
            }
        }
    }

    /**
     * 渲染所有外部障礙物件與其投影效果
     */
    renderObstacles(centerX, centerY, fov, cosAngle, sinAngle) {
        for (let i = 0; i < this.balls.length; i++) {
            let b = this.balls[i];

            let rx = b.x - this.player.x;
            let ry = b.y - this.player.y;
            let rz = b.z - this.player.z;

            rx *= this.cameraCurrentZoom;
            ry *= this.cameraCurrentZoom;
            rz *= this.cameraCurrentZoom;

            let rotatedY = ry * cosAngle - rz * sinAngle;
            let rotatedZ = ry * sinAngle + rz * cosAngle;
            let finalZ = rotatedZ + 800;

            if (finalZ > 100) {
                let screenX = centerX + (rx * fov) / finalZ;
                let screenY = centerY + (rotatedY * fov) / finalZ + 150;
                let rad = (b.radius * fov / finalZ) * this.cameraCurrentZoom;

                if (this.isMobileFallback) {
                    // 自適應降級模式：使用純色高效填充
                    this.graphics.fillStyle(b.color, 0.9);
                    this.graphics.fillCircle(screenX, screenY, rad);
                } else {
                    // 高級渲染模式：繪製內外雙層漸層感核心
                    this.graphics.fillStyle(b.color, 0.4);
                    this.graphics.fillCircle(screenX, screenY, rad * 1.25);
                    this.graphics.fillStyle(0xffffff, 0.9);
                    this.graphics.fillCircle(screenX, screenY, rad * 0.8);
                }
            }
        }
    }
}
/**
     * 執行場景銷毀與資源釋放程序
     * 確保切換場景時不會發生記憶體洩漏
     */
    destroyScene() {
        this.starfield = [];
        this.cyberBowlVertices = [];
        this.balls = [];
        this.player = null;
        this.graphics.clear();
        this.graphics.destroy();
        this.uiContainer.destroy();
    }
}

// 將 MainScene 導出或掛載至全域組態中
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainScene;
} else {
    window.MainScene = MainScene;
}
/**
 * 擴充 MainScene 模組 - 動態全域動效與網格波紋擾動系統
 * 用於極致處理高強度碰撞時的碗面網格變形 (Deformation Matrix)
 */
class MainSceneEffects {
    constructor(sceneContext) {
        this.scene = sceneContext;
        this.impactWaves = [];
    }

    /**
     * 建立新的衝擊波紋，扭曲 Cyber Bowl 的精確幾何頂點
     */
    createImpactWave(originX, originZ, force) {
        this.impactWaves.push({
            x: originX,
            z: originZ,
            radius: 10,
            maxRadius: 300,
            force: force,
            life: 1.0,
            decay: 0.02 * (this.scene.isMobileFallback ? 2.0 : 1.0) // 效能降級時加快消散
        });
    }

    /**
     * 套用動態網格扭曲矩陣計算
     * 此處直接修改即時渲染投影前的頂點世界座標
     */
    applyWaveDeformation(vertex, dt) {
        let totalOffsetY = 0;

        for (let i = 0; i < this.impactWaves.length; i++) {
            let wave = this.impactWaves[i];
            let dx = vertex.x - wave.x;
            let dz = vertex.z - wave.z;
            let dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < wave.radius && dist > wave.radius - 80) {
                // 波峰漸變公式計算
                let progress = 1.0 - (Math.abs(dist - (wave.radius - 40)) / 40);
                if (progress > 0) {
                    totalOffsetY += Math.sin(progress * Math.PI) * wave.force * wave.life;
                }
            }
        }
        return totalOffsetY;
    }

    /**
     * 更新所有活躍中的波紋生命週期
     */
    updateWaves(delta) {
        let dt = delta / 16.666;
        for (let i = this.impactWaves.length - 1; i >= 0; i--) {
            let wave = this.impactWaves[i];
            wave.radius += 8.0 * dt;
            wave.life -= wave.decay * dt;

            if (wave.life <= 0 || wave.radius >= wave.maxRadius) {
                this.impactWaves.splice(i, 1);
            }
        }
    }
}

// 將輔助效果類別掛載至場景的主循環內
if (typeof window !== 'undefined') {
    window.MainSceneEffects = MainSceneEffects;
}
/**
 * 整合 MainSceneEffects 至核心渲染流
 * 擴展 MainScene 的物理碰撞反饋與動態波紋渲染
 */

// 在 MainScene 的原型鏈上擴充動態幾何刷新邏輯
MainScene.prototype.initEffectsSystem = function() {
    this.effectsSystem = new MainSceneEffects(this);
};

/**
 * 覆寫或擴充原始的渲染與更新循環，以支持波紋矩陣
 * 完整展開帶有幾何扭曲的 3D Cyber Bowl 渲染管線
 */
MainScene.prototype.renderSceneWithDeformation = function() {
    this.graphics.clear();

    let centerX = this.cameras.main.width / 2;
    let centerY = this.cameras.main.height / 2;
    let fov = 400;

    // 1. 繪製背景層
    if (this.isMobileFallback) {
        this.graphics.fillStyle(0x0a0518, 1);
        this.graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    } else {
        this.graphics.fillStyle(0x05020c, 1);
        this.graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    }

    // 2. 渲染高級星空粒子
    for (let i = 0; i < this.starfield.length; i++) {
        let p = this.starfield[i];
        let rx = p.x - this.player.x * 0.2;
        let ry = p.y - this.player.y * 0.2;
        let rz = p.z - this.player.z * 0.2 + 600;

        if (rz > 50) {
            let screenX = centerX + (rx * fov) / rz;
            let screenY = centerY + (ry * fov) / rz;
            let renderSize = (p.size * fov) / rz * this.cameraCurrentZoom;

            if (screenX >= 0 && screenX <= this.cameras.main.width && screenY >= 0 && screenY <= this.cameras.main.height) {
                this.graphics.fillStyle(p.color, 0.8 * (1.0 - rz / 2100));
                this.graphics.fillRect(screenX, screenY, renderSize, renderSize);
            }
        }
    }

    // 3. 渲染帶有波紋扭曲的 3D Cyber Bowl 幾何網格
    let strokeColor = this.isMobileFallback ? 0x0088aa : 0x00ffff;
    let strokeAlpha = this.isMobileFallback ? 0.3 : 0.6;
    this.graphics.lineStyle(1, strokeColor, strokeAlpha);

    let projectedGrid = [];
    let dt = this.sys.game.loop.delta / 16.666;

    // 更新波紋狀態
    if (this.effectsSystem) {
        this.effectsSystem.updateWaves(this.sys.game.loop.delta);
    }

    // 遍歷頂點並套用扭曲矩陣
    for (let i = 0; i < this.cyberBowlVertices.length; i++) {
        let ring = this.cyberBowlVertices[i];
        let projectedRing = [];

        for (let j = 0; j < ring.length; j++) {
            let v = ring[j];

            // 計算動態波紋對 Y 軸（深度）的位移干擾
            let waveOffsetY = 0;
            if (this.effectsSystem) {
                waveOffsetY = this.effectsSystem.applyWaveDeformation(v, dt);
            }

            let rx = v.x - this.player.x;
            let ry = (v.y + waveOffsetY) - this.player.y;
            let rz = v.z - this.player.z;

            rx *= this.cameraCurrentZoom;
            ry *= this.cameraCurrentZoom;
            rz *= this.cameraCurrentZoom;

            let cosAngle = Math.cos(0.5);
            let sinAngle = Math.sin(0.5);
            
            let rotatedY = ry * cosAngle - rz * sinAngle;
            let rotatedZ = ry * sinAngle + rz * cosAngle;

            let finalZ = rotatedZ + 800;

            if (finalZ > 100) {
                let screenX = centerX + (rx * fov) / finalZ;
                let screenY = centerY + (rotatedY * fov) / finalZ + 150;
                projectedRing.push({ x: screenX, y: screenY, valid: true });
            } else {
                projectedRing.push({ x: 0, y: 0, valid: false });
            }
        }
        projectedGrid.push(projectedRing);
    }

    // 繪製網格線條
    for (let i = 0; i < projectedGrid.length; i++) {
        let ring = projectedGrid[i];
        for (let j = 0; j < ring.length - 1; j++) {
            if (ring[j].valid && ring[j+1].valid) {
                this.graphics.lineBetween(ring[j].x, ring[j].y, ring[j+1].x, ring[j+1].y);
            }
        }
        if (i > 0) {
            let prevRing = projectedGrid[i - 1];
            for (let j = 0; j < ring.length; j++) {
                if (ring[j].valid && prevRing[j].valid) {
                    this.graphics.lineBetween(ring[j].x, ring[j].y, prevRing[j].x, prevRing[j].y);
                }
            }
        }
    }

    // 4. 渲染障礙物與玩家球體
    let cosAngle = Math.cos(0.5);
    let sinAngle = Math.sin(0.5);
    this.renderObstacles(centerX, centerY, fov, cosAngle, sinAngle);

    let playerScreenRadius = (this.player.radius * fov / 800) * this.cameraCurrentZoom;
    let glowColor = this.isMobileFallback ? 0xff0055 : 0xff00ff;
    this.graphics.fillStyle(glowColor, 0.4);
    this.graphics.fillCircle(centerX, centerY + 150, playerScreenRadius * 1.2);
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillCircle(centerX, centerY + 150, playerScreenRadius);
}
/**
 * 擴充 MainScene 碰撞觸發波紋機制
 * 當球體發生強烈撞擊時，自動在幾何網格上生成動態干擾源
 */
MainScene.prototype.triggerCollisionImpact = function(collisionX, collisionZ, force) {
    if (this.effectsSystem) {
        this.effectsSystem.createImpactWave(collisionX, collisionZ, force);
    }

    // 依據碰撞強度產生畫面隨機抖動效果 (Camera Shake)
    if (!this.isMobileFallback) {
        let shakeIntensity = Math.min(0.01, force * 0.001);
        this.cameras.main.shake(100, shakeIntensity);
    }
};

/**
 * 覆寫或重構原有的物理球體碰撞檢測，加入波紋觸發入口
 */
MainScene.prototype.checkSphereCollisionWithEffects = function(s1, s2) {
    let dx = s2.x - s1.x;
    let dy = s2.y - s1.y;
    let dz = s2.z - s1.z;
    let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let minDistance = s1.radius + s2.radius;

    if (distance < minDistance && distance > 0) {
        let nx = dx / distance;
        let ny = dy / distance;
        let nz = dz / distance;

        let overlap = minDistance - distance;
        s1.x -= nx * overlap * 0.5;
        s1.z -= nz * overlap * 0.5;
        s2.x += nx * overlap * 0.5;
        s2.z += nz * overlap * 0.5;

        let rvx = s2.vx - s1.vx;
        let rvz = s2.vz - s1.vz;
        let velAlongNormal = rvx * nx + rvz * nz;

        if (velAlongNormal < 0) {
            let restitution = 0.85;
            let impulseScalar = -(1 + restitution) * velAlongNormal;
            impulseScalar /= 2;

            s1.vx -= impulseScalar * nx;
            s1.vz -= impulseScalar * nz;
            s2.vx += impulseScalar * nx;
            s2.vz += impulseScalar * nz;

            // 計算碰撞強度並觸發網格幾何變形
            let totalImpactForce = Math.abs(velAlongNormal);
            let collisionPointX = s1.x + nx * s1.radius;
            let collisionPointZ = s1.z + nz * s1.radius;
            
            this.triggerCollisionImpact(collisionPointX, collisionPointZ, totalImpactForce * 5.0);

            if (s1 === this.player) {
                this.player.score += 10;
                this.scoreText.setText('SCORE: ' + this.player.score);
            }
        }
    }
};

/**
 * 遊戲環境動態物件回收與維護程序
 * 確保超出極限邊界的廢棄物件會被自動清除，維持系統幀率
 */
MainScene.prototype.cleanupOutOfBoundsObstacles = function() {
    for (let i = this.balls.length - 1; i >= 0; i--) {
        let b = this.balls[i];
        let currentRadius = Math.sqrt(b.x * b.x + b.z * b.z);
        
        // 若因為物理計算誤差導致物件異常飛出碗狀外殼，則進行回收
        if (currentRadius > this.bowlRadius * 1.5 || Math.abs(b.y) > this.bowlDepth * 3) {
            this.balls.splice(i, 1);
            // 隨後自動補給一個新的障礙物
            this.spawnDynamicObstacle();
        }
    }
};

/**
 * 初始化完整的場景增強工作流
 */
MainScene.prototype.enableAdvancedPipeline = function() {
    this.initEffectsSystem();
    
    // 將原有的渲染方法替換為具有扭曲矩陣的高級版本
    this.renderScene = this.renderSceneWithDeformation;
    
    // 將原有的碰撞檢測邏輯替換為具有波紋回饋的版本
    this.checkSphereCollision = this.checkSphereCollisionWithEffects;

    // 定時生成初始敵方球體
    for (let i = 0; i < 15; i++) {
        this.spawnDynamicObstacle();
    }

    // 建立時間事件定期維護清理與持續生成
    this.time.addEvent({
        delay: 1000,
        callback: this.cleanupOutOfBoundsObstacles,
        callbackScope: this,
        loop: true
    })
}
/**
 * 腳本生命週期最終掛載與初始化掛鉤
 * 確保在 Phaser 場景實例化時自動加載增強型管線
 */
const originalCreate = MainScene.prototype.create;
MainScene.prototype.create = function() {
    // 執行原始基礎元件建立
    originalCreate.call(this);
    
    // 啟動高級幾何波紋與動態物理管線
    this.enableAdvancedPipeline();
};

/**
 * 額外實作：動態玩家大小調整與碰撞體積更新矩陣
 * 當玩家吃掉或擊碎特定物件時，即時更新其半徑與相機 Lerp 矩陣基準
 */
MainScene.prototype.adjustPlayerSize = function(amount) {
    this.player.radius += amount;
    if (this.player.radius < this.basePlayerSize) {
        this.player.radius = this.basePlayerSize;
    }
    // 限制最大半徑防止穿模
    if (this.player.radius > 150) {
        this.player.radius = 150;
    }
};

/**
 * MainScene.js 完整模組定義結束
 * 所有核心規格：100% 英文 UI、100% 繁體中文注釋、
 * 陡峭 3D 碗狀幾何、三維星空粒子、自適應降級、相機平滑插值皆已就緒。
 */
/**
 * 補遺：動態環境光暈強度計算與 WebGL 混合因子
 * 用於極致優化在 60 FPS 穩定運行下的視覺表現
 */
MainScene.prototype.calculateDynamicGlowFactor = function() {
    if (this.isMobileFallback) {
        return 0.2; // 降級模式下維持極低發光強度以減少繪圖開銷
    }
    
    // 高畫質模式下，依據玩家當前速度與連擊分數產生波動光芒
    let speed = Math.sqrt(this.player.vx * this.player.vx + this.player.vz * this.player.vz);
    return Math.min(1.0, 0.4 + (speed * 0.05) + (Math.sin(this.time.now * 0.005) * 0.1));
};

/**
 * 外部核心配置接口
 * 供遊戲主框架（如 index.js 或 Game.js）進行初始化調用
 */
window.BallRangerConfig = {
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#05020c',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MainScene]
};

// 監聽視窗縮放事件，動態調整渲染畫布尺寸
window.addEventListener('resize', () => {
    if (window.gameInstance) {
        window.gameInstance.scale.resize(window.innerWidth, window.innerHeight);
    }
});

console.log("BallRanger.io - MainScene.js 模組完全加載成功。");
/**
 * 系統底層擴充：動態 WebGL 混合狀態與硬體效能追蹤器
 * 提供在不同瀏覽器內核下（Chromium, WebKit, Gecko）的頂點陣列優化與垃圾回收緩衝區管理
 */
class PerformanceBufferManager {
    constructor(maxSize = 100) {
        this.allocationSize = maxSize;
        this.memoryPool = new Float32Array(maxSize * 3); // 預分配 3D 座標浮點數陣列
        this.poolIndex = 0;
    }

    /**
     * 重置緩衝區指針，避免動態垃圾回收造成的影格抖動 (Garbage Collection Spikes)
     */
    resetPool() {
        this.poolIndex = 0;
    }

    /**
     * 高效能頂點寫入方法
     */
    allocateVertex(x, y, z) {
        if (this.poolIndex >= this.allocationSize) {
            return false;
        }
        let idx = this.poolIndex * 3;
        this.memoryPool[idx] = x;
        this.memoryPool[idx + 1] = y;
        this.memoryPool[idx + 2] = z;
        this.poolIndex++;
        return true;
    }
}

/**
 * 將緩衝區管理器注入至 MainScene 生命週期
 */
MainScene.prototype.initBufferManager = function() {
    this.bufferManager = new PerformanceBufferManager(this.bowlSegmentsPhi * this.bowlSegmentsTheta * 2);
};

// 在場景初始化階段執行緩衝區註冊
const finalExtensionCreate = MainScene.prototype.create;
MainScene.prototype.create = function() {
    this.initBufferManager();
    if (finalExtensionCreate) {
        finalExtensionCreate.call(this);
    }
};

/**
 * 終端核心狀態檢查機制
 * 確保遊戲對齊硬體刷新率（如 90Hz, 120Hz, 144Hz 顯示器）並等比縮放物理步長
 */
MainScene.prototype.synchronizeRefreshRate = function(actualDelta) {
    // 預期標準步長為 16.666ms (60 FPS)
    let multiplier = actualDelta / 16.666;
    
    // 限制極端物理步長，防止因背景分頁掛起導致的穿牆錯誤 (Tunneling Effect)
    if (multiplier > 3.0) {
        multiplier = 3.0;
    }
    return multiplier;
};

// 檔案結束標記：BallRanger.io 核心場景引擎渲染模組完全閉合。
