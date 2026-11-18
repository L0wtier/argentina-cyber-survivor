// Detecta pantallas táctiles (celulares / tablets)
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// Calcula un tamaño lógico de juego que se adapte a la forma de la pantalla
// manteniendo aproximadamente la misma área visible que el 800x600 original.
const BASE_GAME_AREA = 800 * 600;
function computeGameSize() {
    const vw = window.innerWidth || 800;
    const vh = window.innerHeight || 600;
    const aspect = Phaser.Math.Clamp(vw / vh, 0.45, 2.3);
    const width = Math.round(Math.sqrt(BASE_GAME_AREA * aspect));
    const height = Math.round(width / aspect);
    return { width, height };
}

const initialSize = computeGameSize();

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#111111',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: initialSize.width,
        height: initialSize.height
    },
    input: {
        activePointers: 3
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let gameInstance;
let player;
let cursors;
let wasd;
let escKey;
let dronesGroup;
let shooterDronesGroup;
let shooterBulletsGroup;
let gemsGroup;
let goldGroup;
let bulletsGroup;
let meleeSwingsGroup;
let auraGraphics;
let lastFired = 0;
let lastMelee = 0;
let levelText;
let timerText;
let goldText;
let healthBarBg;
let healthBarFill;
let xpBarBg;
let xpBarFill;
let xp = 0;
let gold = 305; // Oro inicial de prueba para las mejoras
let level = 1;
let maxXp = 100;
let hp = 100;
let maxHp = 100;
let gameTime = 0;
let timeEvent;
let droneSpawnCount = 0;
let isInvulnerable = false;
let isPaused = false;
let isGameOver = false;
let selectedCharacter = 'P1';

// Niveles de mejoras permanentes
let upgrades = {
    hp: { level: 0, cost: 50 },
    damage: { level: 0, cost: 60 },
    speed: { level: 0, cost: 50 },
    luck: { level: 0, cost: 70 },
    crit: { level: 0, cost: 80 }
};

let mainMenuUI;
let upgradesUI;
let levelUpPanel;
let pausePanel;
let gameOverPanel;
let currentSceneInstance;
let hpLabel;
let pauseButton;

// Joystick virtual (táctil / arrastre con el mouse)
const JOY_RADIUS = 60;
let joystick = { active: false, pointerId: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
let joyBase;
let joyKnob;

function preload() {
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('drone', 'https://labs.phaser.io/assets/sprites/ufo.png');
    this.load.image('shooter', 'https://labs.phaser.io/assets/sprites/ilk.png');
    this.load.image('gem', 'https://labs.phaser.io/assets/sprites/diamond.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/purple_ball.png');
    this.load.image('enemy-bullet', 'https://labs.phaser.io/assets/sprites/red_ball.png');
}

function create() {
    currentSceneInstance = this;
    xp = 0;
    level = 1;
    maxXp = 100;
    maxHp = 100 + (upgrades.hp.level * 20);
    hp = maxHp;
    gameTime = 0;
    droneSpawnCount = 0;
    isInvulnerable = false;
    isPaused = true; 
    isGameOver = false;
    lastFired = 0;
    lastMelee = 0;

    this.add.grid(1200, 900, 2400, 1800, 64, 64, 0x1a1a1a, 1, 0x333333, 1);
    this.physics.world.setBounds(0, 0, 2400, 1800);

    player = this.physics.add.sprite(1200, 900, 'player');
    player.setCollideWorldBounds(true);
    player.setScale(1.5);

    applyCharacterVisuals();

    this.cameras.main.setBounds(0, 0, 2400, 1800);
    this.cameras.main.startFollow(player, true, 0.09, 0.09);

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    dronesGroup = this.physics.add.group();
    shooterDronesGroup = this.physics.add.group();
    shooterBulletsGroup = this.physics.add.group();
    gemsGroup = this.physics.add.group();
    goldGroup = this.physics.add.group();
    bulletsGroup = this.physics.add.group();
    meleeSwingsGroup = this.physics.add.group();

    auraGraphics = this.add.graphics();

    const HUD_DEPTH = 500;
    xpBarBg = this.add.rectangle(0, 0, this.scale.width, 8, 0x222222).setOrigin(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
    xpBarFill = this.add.rectangle(0, 0, 0, 8, 0x00aaff).setOrigin(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH);

    hpLabel = this.add.text(16, 20, 'HP:', { fontSize: '16px', fill: '#ff4d4d', fontStyle: 'bold' }).setScrollFactor(0).setDepth(HUD_DEPTH);
    healthBarBg = this.add.rectangle(50, 28, 150, 14, 0x333333).setScrollFactor(0).setDepth(HUD_DEPTH);
    healthBarBg.setOrigin(0, 0.5);
    healthBarFill = this.add.rectangle(50, 28, 150, 14, 0xff4d4d).setScrollFactor(0).setDepth(HUD_DEPTH);
    healthBarFill.setOrigin(0, 0.5);

    levelText = this.add.text(16, 48, 'Nivel: 1', { fontSize: '18px', fill: '#ffff00', fontStyle: 'bold' }).setScrollFactor(0).setDepth(HUD_DEPTH);
    goldText = this.add.text(16, 74, 'Oro: ' + gold, { fontSize: '16px', fill: '#ffcc00', fontStyle: 'bold' }).setScrollFactor(0).setDepth(HUD_DEPTH);

    timerText = this.add.text(this.scale.width / 2, 25, '00:00', { fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' }).setScrollFactor(0).setDepth(HUD_DEPTH);
    timerText.setOrigin(0.5, 0);

    // Reacomoda el HUD cuando cambia el tamaño / orientación de la pantalla
    this.scale.on('resize', layoutHUD);
    this.events.once('shutdown', () => this.scale.off('resize', layoutHUD));
    layoutHUD();

    createJoystick(this);

    this.time.addEvent({
        delay: 1000,
        callback: updateGameTime,
        callbackScope: this,
        loop: true
    });

    timeEvent = this.time.addEvent({
        delay: 1500,
        callback: spawnDrone,
        callbackScope: this,
        loop: true
    });

    this.physics.add.overlap(player, dronesGroup, hitPlayer, null, this);
    this.physics.add.overlap(player, shooterDronesGroup, hitPlayer, null, this);
    this.physics.add.overlap(player, shooterBulletsGroup, hitPlayerByBullet, null, this);
    this.physics.add.overlap(bulletsGroup, dronesGroup, hitDrone, null, this);
    this.physics.add.overlap(bulletsGroup, shooterDronesGroup, hitShooterDrone, null, this);
    this.physics.add.overlap(meleeSwingsGroup, dronesGroup, hitDroneMelee, null, this);
    this.physics.add.overlap(meleeSwingsGroup, shooterDronesGroup, hitShooterDroneMelee, null, this);
    this.physics.add.overlap(player, gemsGroup, collectGem, null, this);
    this.physics.add.overlap(player, goldGroup, collectGold, null, this);

    createMainMenuUI();
    createUpgradesUI();
    createSidePanelUI();
    createLevelUpUI();
    createPauseUI();
    createGameOverUI();
    createPauseButton();
}

function layoutHUD() {
    if (!currentSceneInstance || !xpBarBg || !xpBarBg.active) return;
    const w = currentSceneInstance.scale.width;
    xpBarBg.setSize(w, 8);
    updateXpBar();
    timerText.setPosition(w / 2, 25);
}

function createJoystick(scene) {
    joystick = { active: false, pointerId: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };

    joyBase = scene.add.circle(0, 0, JOY_RADIUS, 0xffffff, 0.08)
        .setStrokeStyle(2, 0x66c0f4, 0.6)
        .setScrollFactor(0)
        .setDepth(1000)
        .setVisible(false);
    joyKnob = scene.add.circle(0, 0, 24, 0x66c0f4, 0.5)
        .setScrollFactor(0)
        .setDepth(1001)
        .setVisible(false);

    scene.input.on('pointerdown', (pointer) => {
        if (isPaused || isGameOver || joystick.active) return;
        joystick.active = true;
        joystick.pointerId = pointer.id;
        joystick.baseX = pointer.x;
        joystick.baseY = pointer.y;
        joystick.dx = 0;
        joystick.dy = 0;
        joyBase.setPosition(pointer.x, pointer.y).setVisible(true);
        joyKnob.setPosition(pointer.x, pointer.y).setVisible(true);
    });

    scene.input.on('pointermove', (pointer) => {
        if (!joystick.active || pointer.id !== joystick.pointerId) return;
        let dx = pointer.x - joystick.baseX;
        let dy = pointer.y - joystick.baseY;
        const len = Math.hypot(dx, dy);
        if (len > JOY_RADIUS) {
            dx = dx / len * JOY_RADIUS;
            dy = dy / len * JOY_RADIUS;
        }
        joystick.dx = dx;
        joystick.dy = dy;
        joyKnob.setPosition(joystick.baseX + dx, joystick.baseY + dy);
    });

    const release = (pointer) => {
        if (!joystick.active || pointer.id !== joystick.pointerId) return;
        resetJoystick();
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
}

function resetJoystick() {
    joystick.active = false;
    joystick.pointerId = null;
    joystick.dx = 0;
    joystick.dy = 0;
    if (joyBase && joyBase.active) joyBase.setVisible(false);
    if (joyKnob && joyKnob.active) joyKnob.setVisible(false);
}

function createPauseButton() {
    if (!pauseButton) {
        pauseButton = document.createElement('button');
        pauseButton.id = 'btn-pause';
        pauseButton.setAttribute('aria-label', 'Pausa');
        pauseButton.innerText = 'II';
        pauseButton.onclick = () => togglePause();
        document.body.appendChild(pauseButton);
    }
    updatePauseButton();
}

function updatePauseButton() {
    if (!pauseButton) return;
    const menuOpen = (mainMenuUI && mainMenuUI.style.display !== 'none') ||
        (upgradesUI && upgradesUI.style.display === 'block');
    pauseButton.style.display = (menuOpen || isGameOver) ? 'none' : 'block';
}

function applyCharacterVisuals() {
    if (selectedCharacter === 'P1') player.setTint(0x00ffff);
    else if (selectedCharacter === 'P2') player.setTint(0xff5500);
    else if (selectedCharacter === 'P3') player.setTint(0xaa00ff);
}

function update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(escKey)) {
        togglePause();
    }

    if (isPaused || isGameOver) {
        if (joystick.active) resetJoystick();
        return;
    }

    // Lógica de Aura para P3
    auraGraphics.clear();
    if (selectedCharacter === 'P3') {
        auraGraphics.lineStyle(2, 0xaa00ff, 0.8);
        auraGraphics.fillStyle(0xaa00ff, 0.15);
        auraGraphics.strokeCircle(player.x, player.y, 100);
        auraGraphics.fillCircle(player.x, player.y, 100);

        let allEnemies = shooterDronesGroup.getChildren().concat(dronesGroup.getChildren());
        allEnemies.forEach(enemy => {
            if (enemy && enemy.active) {
                let dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
                if (dist < 100) {
                    enemy.hp -= 0.05;
                    if (enemy.hp <= 0) destroyEnemy(enemy);
                }
            }
        });
    }

    player.body.setVelocity(0);

    let baseSpeed = 200;
    let speed = baseSpeed + (upgrades.speed.level * 10);
    if (wasd.left.isDown || cursors.left.isDown) {
        player.setVelocityX(-speed);
    } else if (wasd.right.isDown || cursors.right.isDown) {
        player.setVelocityX(speed);
    }

    if (wasd.up.isDown || cursors.up.isDown) {
        player.setVelocityY(-speed);
    } else if (wasd.down.isDown || cursors.down.isDown) {
        player.setVelocityY(speed);
    }

    // Movimiento con joystick táctil
    if (joystick.active) {
        const len = Math.hypot(joystick.dx, joystick.dy);
        if (len > 8) {
            const force = Math.min(1, len / JOY_RADIUS);
            player.setVelocity(joystick.dx / len * speed * force, joystick.dy / len * speed * force);
        }
    }

    dronesGroup.children.iterate(function (drone) {
        if (drone) {
            currentSceneInstance.physics.moveToObject(drone, player, drone.speed);
        }
    }, this);

    shooterDronesGroup.children.iterate(function (drone) {
        if (drone) {
            let distance = Phaser.Math.Distance.Between(drone.x, drone.y, player.x, player.y);
            if (distance > 300) {
                currentSceneInstance.physics.moveToObject(drone, player, 80);
            } else {
                drone.body.setVelocity(0);
            }
        }
    }, this);

    if (selectedCharacter === 'P1' && time > lastFired) {
        fireAutoWeapon(time);
    } else if (selectedCharacter === 'P2' && time > lastMelee) {
        executeMeleeAttack(time);
    }
}

function updateGameTime() {
    if (isPaused || isGameOver) return;
    gameTime++;

    let minutes = Math.floor(gameTime / 60);
    let seconds = gameTime % 60;
    timerText.setText((minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds));

    if (gameTime % 30 === 0) {
        timeEvent.delay = Math.max(400, 1500 - (gameTime * 15));
    }
}

function spawnDrone() {
    if (isPaused || isGameOver) return;
    let angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // Aparecen fuera de la pantalla, sin importar la orientación
    let minDistance = Math.max(500, Math.hypot(currentSceneInstance.scale.width, currentSceneInstance.scale.height) / 2 + 40);
    let distance = Phaser.Math.Between(minDistance, minDistance + 300);
    let x = player.x + Math.cos(angle) * distance;
    let y = player.y + Math.sin(angle) * distance;

    droneSpawnCount++;

    if (droneSpawnCount % 15 === 0) {
        let shooter = shooterDronesGroup.create(x, y, 'shooter');
        shooter.setScale(1.2);
        shooter.hp = 4;
        
        currentSceneInstance.time.addEvent({
            delay: 3000,
            callback: () => {
                if (isPaused || isGameOver || !shooter.active) return;
                let sBullet = shooterBulletsGroup.create(shooter.x, shooter.y, 'enemy-bullet');
                if (sBullet) {
                    sBullet.setScale(0.8);
                    currentSceneInstance.physics.moveToObject(sBullet, player, 150);
                    currentSceneInstance.time.delayedCall(4000, () => { if (sBullet && sBullet.active) sBullet.destroy(); });
                }
            },
            loop: true
        });
    } else {
        let drone = dronesGroup.create(x, y, 'drone');
        drone.setScale(0.8);
        let scalingFactor = Math.floor(gameTime / 30);
        drone.hp = 2 + Math.floor(scalingFactor / 2);
        drone.speed = 90 + (scalingFactor * 5);
    }
}

function fireAutoWeapon(time) {
    let allEnemies = shooterDronesGroup.getChildren().concat(dronesGroup.getChildren());
    let closestDrone = currentSceneInstance.physics.closest(player, allEnemies);
    
    if (closestDrone) {
        let bullet = bulletsGroup.create(player.x, player.y, 'bullet');
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            currentSceneInstance.physics.moveToObject(bullet, closestDrone, 350);
            lastFired = time + 1100;
            
            currentSceneInstance.time.delayedCall(2500, () => {
                if (bullet && bullet.active) bullet.destroy();
            });
        }
    }
}

function executeMeleeAttack(time) {
    // P2: Rango ampliado a 1 cuerpo entero alrededor del jugador (radio ~60 píxeles)
    let swing = currentSceneInstance.add.circle(player.x, player.y, 60, 0xff5500, 0.3);
    currentSceneInstance.physics.add.existing(swing);
    swing.body.setCircle(60);
    meleeSwingsGroup.add(swing);

    lastMelee = time + 700;

    currentSceneInstance.time.delayedCall(150, () => {
        if (swing && swing.active) {
            meleeSwingsGroup.remove(swing, true, true);
        }
    });
}

function hitDrone(bullet, drone) {
    bullet.destroy();
    let damage = 1 + (upgrades.damage.level * 0.5);
    drone.hp -= damage;
    if (drone.hp <= 0) destroyEnemy(drone);
}

function hitShooterDrone(bullet, drone) {
    bullet.destroy();
    let damage = 1 + (upgrades.damage.level * 0.5);
    drone.hp -= damage;
    if (drone.hp <= 0) destroyEnemy(drone);
}

function hitDroneMelee(swing, drone) {
    let damage = 2 + upgrades.damage.level;
    drone.hp -= damage;
    if (drone.hp <= 0) destroyEnemy(drone);
}

function hitShooterDroneMelee(swing, drone) {
    let damage = 2 + upgrades.damage.level;
    drone.hp -= damage;
    if (drone.hp <= 0) destroyEnemy(drone);
}

function destroyEnemy(drone) {
    let x = drone.x, y = drone.y;
    drone.destroy();

    let gem = gemsGroup.create(x, y, 'gem');
    gem.setScale(0.6);

    // Probabilidad de soltar oro afectada por la mejora "Suerte"
    let luckChance = 0.3 + (upgrades.luck.level * 0.05);
    if (Math.random() < luckChance) {
        // Creamos una moneda de oro pequeña usando un gráfico circular dorado
        let coin = currentSceneInstance.add.circle(x + 10, y, 6, 0xffcc00);
        currentSceneInstance.physics.add.existing(coin);
        goldGroup.add(coin);
    }
}

function collectGem(player, gem) {
    gem.destroy();
    xp += 35;
    updateXpBar();

    if (xp >= maxXp) {
        triggerLevelUp();
    }
}

function collectGold(player, coin) {
    coin.destroy();
    gold += 5;
    goldText.setText('Oro: ' + gold);
}

function updateXpBar() {
    let percentage = xp / maxXp;
    if (percentage > 1) percentage = 1;
    xpBarFill.setSize(currentSceneInstance.scale.width * percentage, 8);
}

function hitPlayer(player, source) {
    if (isInvulnerable || isGameOver) return;
    hp -= 20;
    if (hp < 0) hp = 0;
    updateHealthBar();

    isInvulnerable = true;
    player.setTint(0xff0000);

    if (hp <= 0) {
        triggerGameOver();
        return;
    }

    currentSceneInstance.time.delayedCall(800, () => {
        if (player && player.active) {
            player.clearTint();
            applyCharacterVisuals();
            isInvulnerable = false;
        }
    });
}

function hitPlayerByBullet(player, bullet) {
    bullet.destroy();
    hitPlayer(player, null);
}

function updateHealthBar() {
    let percentage = hp / maxHp;
    if (percentage < 0) percentage = 0;
    healthBarFill.width = 150 * percentage;
}

function createMainMenuUI() {
    if (mainMenuUI) mainMenuUI.remove();
    mainMenuUI = document.createElement('div');
    mainMenuUI.className = 'ui-panel';
    mainMenuUI.style.position = 'absolute';
    mainMenuUI.style.top = '50%';
    mainMenuUI.style.left = '50%';
    mainMenuUI.style.transform = 'translate(-50%, -50%)';
    mainMenuUI.style.background = 'linear-gradient(135deg, #101722, #070a0f)';
    mainMenuUI.style.border = '2px solid #2a475e';
    mainMenuUI.style.borderRadius = '14px';
    mainMenuUI.style.padding = '30px';
    mainMenuUI.style.textAlign = 'center';
    mainMenuUI.style.zIndex = '2000';
    mainMenuUI.style.color = '#fff';
    mainMenuUI.style.width = '480px';
    mainMenuUI.style.boxShadow = '0 20px 50px rgba(0,0,0,0.9)';

    mainMenuUI.innerHTML = `
        <h1 style="color: #66c0f4; margin-top: 0; font-family: sans-serif; letter-spacing: 2px; font-size: 22px;">ARGENTINA CYBER SURVIVOR</h1>
        <div class="char-select">
            <button id="char-p1" style="padding: 10px; background: #1b2838; border: 2px solid #00ffff; color: #fff; border-radius: 8px; cursor: pointer; font-weight: bold;">P1: Distancia</button>
            <button id="char-p2" style="padding: 10px; background: #1b2838; border: 2px solid #2a475e; color: #fff; border-radius: 8px; cursor: pointer; font-weight: bold;">P2: Melee</button>
            <button id="char-p3" style="padding: 10px; background: #1b2838; border: 2px solid #2a475e; color: #fff; border-radius: 8px; cursor: pointer; font-weight: bold;">P3: Aura</button>
        </div>
        <div style="margin: 20px 0;">
            <button id="btn-open-upgrades" style="width: 100%; padding: 12px; background: #2a475e; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">Mejoras (Tienda)</button>
        </div>
        <button id="btn-start-run" style="width: 100%; padding: 14px; background: #2a923b; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; box-shadow: 0 5px 15px rgba(42,146,59,0.4);">ENTRAR A LA MAZMORRA (JUGAR)</button>
    `;

    document.body.appendChild(mainMenuUI);

    document.getElementById('char-p1').onclick = () => selectChar('P1');
    document.getElementById('char-p2').onclick = () => selectChar('P2');
    document.getElementById('char-p3').onclick = () => selectChar('P3');

    document.getElementById('btn-open-upgrades').onclick = () => {
        mainMenuUI.style.display = 'none';
        upgradesUI.style.display = 'block';
        updateUpgradesUI();
    };

    document.getElementById('btn-start-run').onclick = () => {
        mainMenuUI.style.display = 'none';
        isPaused = false;
        updatePauseButton();
        currentSceneInstance.physics.resume();
    };
}

function createUpgradesUI() {
    if (upgradesUI) upgradesUI.remove();
    upgradesUI = document.createElement('div');
    upgradesUI.className = 'ui-panel';
    upgradesUI.style.position = 'absolute';
    upgradesUI.style.top = '50%';
    upgradesUI.style.left = '50%';
    upgradesUI.style.transform = 'translate(-50%, -50%)';
    upgradesUI.style.background = 'linear-gradient(135deg, #101722, #070a0f)';
    upgradesUI.style.border = '2px solid #2a475e';
    upgradesUI.style.borderRadius = '14px';
    upgradesUI.style.padding = '30px';
    upgradesUI.style.textAlign = 'center';
    upgradesUI.style.zIndex = '2005';
    upgradesUI.style.color = '#fff';
    upgradesUI.style.width = '480px';
    upgradesUI.style.display = 'none';
    upgradesUI.style.boxShadow = '0 20px 50px rgba(0,0,0,0.9)';

    upgradesUI.innerHTML = `
        <h2 style="color: #66c0f4; margin-top: 0;">Mejoras</h2>
        <p id="upgrades-gold" style="color: #ffcc00; font-weight: bold;">Oro disponible: ${gold}</p>
        <div style="background: #17212b; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; border: 1px solid #2a475e;">
            <div class="upgrade-row" style="font-size: 13px; color: #8f98a0; display: flex; justify-content: space-between; align-items:center; margin-bottom: 8px;">
                <span>❤️ Vida Máxima (Nivel <span id="lvl-hp">0</span>)</span> 
                <button id="buy-hp" style="background: #2a475e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Comprar (<span id="cost-hp">50</span>g)</button>
            </div>
            <div class="upgrade-row" style="font-size: 13px; color: #8f98a0; display: flex; justify-content: space-between; align-items:center; margin-bottom: 8px;">
                <span>⚡ Daño de Ataque (Nivel <span id="lvl-damage">0</span>)</span> 
                <button id="buy-damage" style="background: #2a475e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Comprar (<span id="cost-damage">60</span>g)</button>
            </div>
            <div class="upgrade-row" style="font-size: 13px; color: #8f98a0; display: flex; justify-content: space-between; align-items:center; margin-bottom: 8px;">
                <span>👟 Velocidad (Nivel <span id="lvl-speed">0</span>)</span> 
                <button id="buy-speed" style="background: #2a475e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Comprar (<span id="cost-speed">50</span>g)</button>
            </div>
            <div class="upgrade-row" style="font-size: 13px; color: #8f98a0; display: flex; justify-content: space-between; align-items:center; margin-bottom: 8px;">
                <span>🍀 Suerte / Drop Oro (Nivel <span id="lvl-luck">0</span>)</span> 
                <button id="buy-luck" style="background: #2a475e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Comprar (<span id="cost-luck">70</span>g)</button>
            </div>
            <div class="upgrade-row" style="font-size: 13px; color: #8f98a0; display: flex; justify-content: space-between; align-items:center;">
                <span>💥 Crítico (Nivel <span id="lvl-crit">0</span>)</span> 
                <button id="buy-crit" style="background: #2a475e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Comprar (<span id="cost-crit">80</span>g)</button>
            </div>
        </div>
        <button id="btn-back-menu" style="width: 100%; padding: 12px; background: #a33; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Volver al Menú Principal</button>
    `;

    document.body.appendChild(upgradesUI);

    document.getElementById('buy-hp').onclick = () => buyUpgrade('hp');
    document.getElementById('buy-damage').onclick = () => buyUpgrade('damage');
    document.getElementById('buy-speed').onclick = () => buyUpgrade('speed');
    document.getElementById('buy-luck').onclick = () => buyUpgrade('luck');
    document.getElementById('buy-crit').onclick = () => buyUpgrade('crit');

    document.getElementById('btn-back-menu').onclick = () => {
        upgradesUI.style.display = 'none';
        mainMenuUI.style.display = 'block';
    };
}

function buyUpgrade(type) {
    let item = upgrades[type];
    if (gold >= item.cost) {
        gold -= item.cost;
        item.level++;
        item.cost = Math.floor(item.cost * 1.5); // Aumenta costo progresivo
        goldText.setText('Oro: ' + gold);
        updateUpgradesUI();
    }
}

function updateUpgradesUI() {
    document.getElementById('upgrades-gold').innerText = 'Oro disponible: ' + gold;
    for (let key in upgrades) {
        document.getElementById('lvl-' + key).innerText = upgrades[key].level;
        document.getElementById('cost-' + key).innerText = upgrades[key].cost;
    }
}

function selectChar(charKey) {
    selectedCharacter = charKey;
    applyCharacterVisuals();
    document.getElementById('char-p1').style.borderColor = (charKey === 'P1') ? '#00ffff' : '#2a475e';
    document.getElementById('char-p2').style.borderColor = (charKey === 'P2') ? '#00ffff' : '#2a475e';
    document.getElementById('char-p3').style.borderColor = (charKey === 'P3') ? '#00ffff' : '#2a475e';
}

function createSidePanelUI() {
    let existingSide = document.getElementById('side-instructions');
    if (existingSide) existingSide.remove();

    let sidePanel = document.createElement('div');
    sidePanel.id = 'side-instructions';
    sidePanel.style.position = 'absolute';
    sidePanel.style.top = '150px';
    sidePanel.style.left = '15px';
    sidePanel.style.width = '200px';
    sidePanel.style.background = 'rgba(15, 22, 36, 0.85)';
    sidePanel.style.border = '1px solid #2a475e';
    sidePanel.style.borderRadius = '8px';
    sidePanel.style.padding = '15px';
    sidePanel.style.color = '#8f98a0';
    sidePanel.style.fontFamily = 'sans-serif';
    sidePanel.style.fontSize = '12px';
    sidePanel.style.zIndex = '900';
    sidePanel.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';

    sidePanel.innerHTML = `
        <strong style="color: #66c0f4; display: block; margin-bottom: 8px; font-size: 13px;">Controles</strong>
        <div style="margin-bottom: 4px;"><strong>WASD:</strong> Moverse</div>
        <div style="margin-bottom: 4px;"><strong>1-2:</strong> Elegir mejora</div>
        <div><strong>ESC:</strong> Pausa</div>
    `;

    document.body.appendChild(sidePanel);
}

function createLevelUpUI() {
    if (levelUpPanel) levelUpPanel.remove();
    levelUpPanel = document.createElement('div');
    levelUpPanel.className = 'ui-panel';
    levelUpPanel.style.position = 'absolute';
    levelUpPanel.style.top = '50%';
    levelUpPanel.style.left = '50%';
    levelUpPanel.style.transform = 'translate(-50%, -50%)';
    levelUpPanel.style.background = 'linear-gradient(135deg, #1b2838, #0d141f)';
    levelUpPanel.style.border = '2px solid #2a475e';
    levelUpPanel.style.borderRadius = '12px';
    levelUpPanel.style.padding = '30px';
    levelUpPanel.style.textAlign = 'center';
    levelUpPanel.style.display = 'none';
    levelUpPanel.style.zIndex = '1000';
    levelUpPanel.style.color = '#fff';
    levelUpPanel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
    levelUpPanel.style.width = '380px';

    levelUpPanel.innerHTML = `
        <h2 id="levelup-title" style="color: #66c0f4; margin-top: 0; font-family: sans-serif;">¡Nivel 2!</h2>
        <p style="color: #8f98a0; font-size: 14px;">${isTouchDevice ? 'Elige una recompensa (toca una opción)' : 'Elige una recompensa (Presiona 1 o 2)'}</p>
        <div id="card-1" style="background: #25384d; border: 1px solid #41739c; padding: 12px; margin: 10px 0; border-radius: 8px; cursor: pointer; text-align: left; position: relative;">
            <span style="position: absolute; right: 10px; top: 10px; display: ${isTouchDevice ? 'none' : 'inline'}; background: #171a21; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #66c0f4;">1</span>
            <strong style="color: #fff; display: block;">Sobrecarga de Poder</strong>
            <span style="color: #8f98a0; font-size: 12px;">Aumenta atributos de combate</span>
        </div>
        <div id="card-2" style="background: #25384d; border: 1px solid #41739c; padding: 12px; margin: 10px 0; border-radius: 8px; cursor: pointer; text-align: left; position: relative;">
            <span style="position: absolute; right: 10px; top: 10px; display: ${isTouchDevice ? 'none' : 'inline'}; background: #171a21; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #66c0f4;">2</span>
            <strong style="color: #fff; display: block;">Propulsores Ágiles</strong>
            <span style="color: #8f98a0; font-size: 12px;">Aumenta la salud máxima y cura</span>
        </div>
    `;

    document.body.appendChild(levelUpPanel);

    document.getElementById('card-1').onclick = () => applyBuff(1);
    document.getElementById('card-2').onclick = () => applyBuff(2);

    window.addEventListener('keydown', (e) => {
        if (levelUpPanel && levelUpPanel.style.display === 'block') {
            if (e.key === '1') applyBuff(1);
            if (e.key === '2') applyBuff(2);
        }
    });
}

gameInstance = new Phaser.Game(config);

function triggerLevelUp() {
    isPaused = true;
    currentSceneInstance.physics.pause();
    levelText.setText('Nivel: ' + level);
    
    let titleEl = document.getElementById('levelup-title');
    if (titleEl) titleEl.innerText = '¡Nivel ' + level + '!';
    
    levelUpPanel.style.display = 'block';
}

function applyBuff(option) {
    if (!levelUpPanel || levelUpPanel.style.display !== 'block') return;
    
    levelUpPanel.style.display = 'none';
    isPaused = false;
    currentSceneInstance.physics.resume();
    xp = 0;
    updateXpBar();
    maxXp += 60;
    level++;
    levelText.setText('Nivel: ' + level);

    if (option === 2) {
        maxHp += 30;
        hp = maxHp;
        updateHealthBar();
    }
}

function createPauseUI() {
    if (pausePanel) pausePanel.remove();
    pausePanel = document.createElement('div');
    pausePanel.className = 'ui-panel';
    pausePanel.style.position = 'absolute';
    pausePanel.style.top = '50%';
    pausePanel.style.left = '50%';
    pausePanel.style.transform = 'translate(-50%, -50%)';
    pausePanel.style.background = 'linear-gradient(135deg, #16202d, #0b1017)';
    pausePanel.style.border = '2px solid #2a475e';
    pausePanel.style.borderRadius = '12px';
    pausePanel.style.padding = '35px';
    pausePanel.style.textAlign = 'center';
    pausePanel.style.display = 'none';
    pausePanel.style.zIndex = '1005';
    pausePanel.style.color = '#fff';
    pausePanel.style.width = '350px';
    pausePanel.style.boxShadow = '0 15px 40px rgba(0,0,0,0.9)';

    pausePanel.innerHTML = `
        <h2 style="color: #66c0f4; margin-top: 0; margin-bottom: 25px;">Pausa</h2>
        <button id="btn-resume" style="width: 100%; padding: 12px; margin: 8px 0; background: #2a475e; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">Continuar</button>
        <button id="btn-abandon" style="width: 100%; padding: 12px; margin: 8px 0; background: #a33; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">Abandonar partida</button>
    `;

    document.body.appendChild(pausePanel);

    document.getElementById('btn-resume').onclick = () => togglePause();
    document.getElementById('btn-abandon').onclick = () => {
        pausePanel.style.display = 'none';
        currentSceneInstance.scene.restart();
    };
}

function togglePause() {
    if (isGameOver || (levelUpPanel && levelUpPanel.style.display === 'block') || (mainMenuUI && mainMenuUI.style.display === 'block') || (upgradesUI && upgradesUI.style.display === 'block')) return;

    isPaused = !isPaused;
    if (isPaused) {
        currentSceneInstance.physics.pause();
        pausePanel.style.display = 'block';
    } else {
        pausePanel.style.display = 'none';
        currentSceneInstance.physics.resume();
    }
}

function createGameOverUI() {
    if (gameOverPanel) gameOverPanel.remove();
    gameOverPanel = document.createElement('div');
    gameOverPanel.className = 'ui-panel';
    gameOverPanel.style.position = 'absolute';
    gameOverPanel.style.top = '50%';
    gameOverPanel.style.left = '50%';
    gameOverPanel.style.transform = 'translate(-50%, -50%)';
    gameOverPanel.style.background = 'rgba(20, 0, 0, 0.95)';
    gameOverPanel.style.border = '2px solid #ff4d4d';
    gameOverPanel.style.borderRadius = '12px';
    gameOverPanel.style.padding = '30px';
    gameOverPanel.style.textAlign = 'center';
    gameOverPanel.style.display = 'none';
    gameOverPanel.style.zIndex = '1001';
    gameOverPanel.style.color = '#fff';
    gameOverPanel.style.width = '350px';

    gameOverPanel.innerHTML = `
        <h2 style="color: #ff4d4d; margin-top: 0;">SISTEMA DESCONECTADO</h2>
        <p id="gameover-stats" style="color: #bbb; font-size: 14px;">Nivel alcanzado: 1</p>
        <button id="btn-restart" style="width: 100%; padding: 12px; margin-top: 15px; background: #ff4d4d; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">REINICIAR RUN</button>
    `;

    document.body.appendChild(gameOverPanel);

    document.getElementById('btn-restart').onclick = () => {
        gameOverPanel.style.display = 'none';
        currentSceneInstance.scene.restart();
    };
}

function triggerGameOver() {
    isGameOver = true;
    currentSceneInstance.physics.pause();
    document.getElementById('gameover-stats').innerText = 'Nivel alcanzado: ' + level + ' | Tiempo: ' + timerText.text;
    gameOverPanel.style.display = 'block';
    resetJoystick();
    updatePauseButton();
}
// Ajusta el tamaño del juego cuando se rota el celular o se cambia el tamaño de la ventana
let resizeTimeout;
function handleViewportResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (!gameInstance || !gameInstance.scale) return;
        const size = computeGameSize();
        if (size.width !== gameInstance.scale.width || size.height !== gameInstance.scale.height) {
            gameInstance.scale.setGameSize(size.width, size.height);
        }
    }, 150);
}
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', handleViewportResize);
