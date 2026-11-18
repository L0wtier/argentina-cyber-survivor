const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
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

const game = new Phaser.Game(config);

let player;
let cursors;
let wasd;
let dronesGroup;
let gemsGroup;
let bulletsGroup;
let lastFired = 0;
let scoreText;
let levelText;
let healthBarBg;
let healthBarFill;
let xp = 0;
let level = 1;
let maxXp = 100;
let hp = 100;
let maxHp = 100;
let isInvulnerable = false;
let isPaused = false;
let isGameOver = false;
let levelUpPanel;
let gameOverPanel;

function preload() {
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('drone', 'https://labs.phaser.io/assets/sprites/ufo.png');
    this.load.image('gem', 'https://labs.phaser.io/assets/sprites/diamond.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/purple_ball.png');
}

function create() {
    xp = 0;
    level = 1;
    maxXp = 100;
    hp = 100;
    maxHp = 100;
    isInvulnerable = false;
    isPaused = false;
    isGameOver = false;
    lastFired = 0;

    this.add.grid(400, 300, 2400, 1800, 64, 64, 0x1a1a1a, 1, 0x333333, 1);
    this.physics.world.setBounds(0, 0, 2400, 1800);

    player = this.physics.add.sprite(1200, 900, 'player');
    player.setCollideWorldBounds(true);
    player.setScale(1.5);

    this.cameras.main.setBounds(0, 0, 2400, 1800);
    this.cameras.main.startFollow(player, true, 0.09, 0.09);

    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    dronesGroup = this.physics.add.group();
    gemsGroup = this.physics.add.group();
    bulletsGroup = this.physics.add.group();

    // Creación de la barra de vida visual
    this.add.text(16, 16, 'HP:', { fontSize: '18px', fill: '#ff4d4d' }).setScrollFactor(0);
    healthBarBg = this.add.rectangle(55, 25, 200, 18, 0x333333).setScrollFactor(0);
    healthBarBg.setOrigin(0, 0.5);
    healthBarFill = this.add.rectangle(55, 25, 200, 18, 0xff4d4d).setScrollFactor(0);
    healthBarFill.setOrigin(0, 0.5);

    scoreText = this.add.text(16, 46, 'XP: 0', { fontSize: '20px', fill: '#00ffcc' }).setScrollFactor(0);
    levelText = this.add.text(16, 76, 'Nivel: 1', { fontSize: '20px', fill: '#ffff00' }).setScrollFactor(0);

    this.time.addEvent({
        delay: 1200,
        callback: spawnDrone,
        callbackScope: this,
        loop: true
    });

    this.physics.add.overlap(player, dronesGroup, hitPlayer, null, this);
    this.physics.add.overlap(bulletsGroup, dronesGroup, hitDrone, null, this);
    this.physics.add.overlap(player, gemsGroup, collectGem, null, this);

    createLevelUpUI.call(this);
    createGameOverUI.call(this);
}

function update(time, delta) {
    if (isPaused || isGameOver) return;

    player.body.setVelocity(0);

    let speed = 200;
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

    dronesGroup.children.iterate(function (drone) {
        if (drone) {
            this.physics.moveToObject(drone, player, 100);
        }
    }, this);

    if (time > lastFired) {
        fireAutoWeapon.call(this, time);
    }
}

function spawnDrone() {
    if (isPaused || isGameOver) return;
    let angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    let distance = Phaser.Math.Between(500, 800);
    let x = player.x + Math.cos(angle) * distance;
    let y = player.y + Math.sin(angle) * distance;

    let drone = dronesGroup.create(x, y, 'drone');
    drone.setScale(0.8);
    drone.hp = 2; // Cada dron aguanta 2 impactos antes de morir
}

function fireAutoWeapon(time) {
    let closestDrone = this.physics.closest(player, dronesGroup.getChildren());
    if (closestDrone) {
        let bullet = bulletsGroup.create(player.x, player.y, 'bullet');
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            this.physics.moveToObject(bullet, closestDrone, 350);
            
            // Cadencia más lenta (dispara cada 1.1 segundos para dejar acercar a los enemigos)
            lastFired = time + 1100;
            
            this.time.delayedCall(2500, () => {
                if (bullet && bullet.active) bullet.destroy();
            });
        }
    }
}

function hitDrone(bullet, drone) {
    bullet.destroy();
    drone.hp -= 1; // Resta vida al dron

    if (drone.hp <= 0) {
        let droneX = drone.x;
        let droneY = drone.y;
        drone.destroy();

        let gem = gemsGroup.create(droneX, droneY, 'gem');
        gem.setScale(0.6);
    }
}

function collectGem(player, gem) {
    gem.destroy();
    xp += 25;
    scoreText.setText('XP: ' + xp);

    if (xp >= maxXp) {
        triggerLevelUp.call(this);
    }
}

function hitPlayer(player, drone) {
    if (isInvulnerable || isGameOver) return;

    hp -= 20;
    if (hp < 0) hp = 0;
    updateHealthBar();

    isInvulnerable = true;
    player.setTint(0xff0000);

    if (hp <= 0) {
        triggerGameOver.call(this);
        return;
    }

    this.time.delayedCall(800, () => {
        if (player && player.active) {
            player.clearTint();
            isInvulnerable = false;
        }
    });
}

function updateHealthBar() {
    let percentage = hp / maxHp;
    if (percentage < 0) percentage = 0;
    healthBarFill.width = 200 * percentage;
}

function createLevelUpUI() {
    if (levelUpPanel) levelUpPanel.remove();
    levelUpPanel = document.createElement('div');
    levelUpPanel.style.position = 'absolute';
    levelUpPanel.style.top = '50%';
    levelUpPanel.style.left = '50%';
    levelUpPanel.style.transform = 'translate(-50%, -50%)';
    levelUpPanel.style.background = 'rgba(0, 0, 0, 0.9)';
    levelUpPanel.style.border = '2px solid #00ffcc';
    levelUpPanel.style.padding = '30px';
    levelUpPanel.style.textAlign = 'center';
    levelUpPanel.style.display = 'none';
    levelUpPanel.style.zIndex = '1000';
    levelUpPanel.style.color = '#fff';

    levelUpPanel.innerHTML = `
        <h2>¡SUBISTE DE NIVEL!</h2>
        <p>Elegí una mejora:</p>
        <button id="btn-buff-1" style="padding: 10px 20px; margin: 5px; background: #00ffcc; border:none; cursor:pointer; font-weight:bold;">+ Daño de Láser</button><br>
        <button id="btn-buff-2" style="padding: 10px 20px; margin: 5px; background: #00ffcc; border:none; cursor:pointer; font-weight:bold;">+ Velocidad de Movimiento</button>
    `;

    document.body.appendChild(levelUpPanel);

    document.getElementById('btn-buff-1').onclick = () => resumeGame.call(this);
    document.getElementById('btn-buff-2').onclick = () => resumeGame.call(this);
}

function triggerLevelUp() {
    isPaused = true;
    this.physics.pause();
    levelUpPanel.style.display = 'block';
}

function resumeGame() {
    levelUpPanel.style.display = 'none';
    isPaused = false;
    this.physics.resume();
    xp = 0;
    level++;
    maxXp += 50;
    levelText.setText('Nivel: ' + level);
    scoreText.setText('XP: ' + xp);
}

function createGameOverUI() {
    if (gameOverPanel) gameOverPanel.remove();
    gameOverPanel = document.createElement('div');
    gameOverPanel.style.position = 'absolute';
    gameOverPanel.style.top = '50%';
    gameOverPanel.style.left = '50%';
    gameOverPanel.style.transform = 'translate(-50%, -50%)';
    gameOverPanel.style.background = 'rgba(20, 0, 0, 0.95)';
    gameOverPanel.style.border = '2px solid #ff4d4d';
    gameOverPanel.style.padding = '30px';
    gameOverPanel.style.textAlign = 'center';
    gameOverPanel.style.display = 'none';
    gameOverPanel.style.zIndex = '1001';
    gameOverPanel.style.color = '#fff';

    gameOverPanel.innerHTML = `
        <h2 style="color: #ff4d4d;">SISTEMA DESCONECTADO</h2>
        <p id="gameover-stats">Nivel alcanzado: 1</p>
        <button id="btn-restart" style="padding: 12px 24px; margin-top: 10px; background: #ff4d4d; color: #fff; border: none; cursor: pointer; font-weight: bold;">REINICIAR RUN</button>
    `;

    document.body.appendChild(gameOverPanel);

    document.getElementById('btn-restart').onclick = () => {
        gameOverPanel.style.display = 'none';
        this.scene.restart();
    };
}

function triggerGameOver() {
    isGameOver = true;
    this.physics.pause();
    document.getElementById('gameover-stats').innerText = 'Nivel alcanzado: ' + level;
    gameOverPanel.style.display = 'block';
}