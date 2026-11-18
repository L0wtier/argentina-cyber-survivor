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
let xp = 0;
let level = 1;
let maxXp = 100;
let isPaused = false;
let levelUpPanel;

function preload() {
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('drone', 'https://labs.phaser.io/assets/sprites/ufo.png');
    this.load.image('gem', 'https://labs.phaser.io/assets/sprites/diamond.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/purple_ball.png');
}

function create() {
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

    scoreText = this.add.text(16, 16, 'XP: 0', { fontSize: '20px', fill: '#00ffcc' }).setScrollFactor(0);
    levelText = this.add.text(16, 46, 'Nivel: 1', { fontSize: '20px', fill: '#ffff00' }).setScrollFactor(0);

    this.time.addEvent({
        delay: 1500,
        callback: spawnDrone,
        callbackScope: this,
        loop: true
    });

    this.physics.add.overlap(player, dronesGroup, hitPlayer, null, this);
    this.physics.add.overlap(bulletsGroup, dronesGroup, hitDrone, null, this);
    this.physics.add.overlap(player, gemsGroup, collectGem, null, this);

    createLevelUpUI.call(this);
}

function update(time, delta) {
    if (isPaused) return;

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
            this.physics.moveToObject(drone, player, 120);
        }
    }, this);

    if (time > lastFired) {
        fireAutoWeapon.call(this, time);
    }
}

function spawnDrone() {
    if (isPaused) return;
    let angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    let distance = Phaser.Math.Between(500, 800);
    let x = player.x + Math.cos(angle) * distance;
    let y = player.y + Math.sin(angle) * distance;

    let drone = dronesGroup.create(x, y, 'drone');
    drone.setScale(0.8);
}

function fireAutoWeapon(time) {
    let closestDrone = this.physics.closest(player, dronesGroup.getChildren());
    if (closestDrone) {
        let bullet = bulletsGroup.create(player.x, player.y, 'bullet');
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            this.physics.moveToObject(bullet, closestDrone, 400);
            lastFired = time + 600;
            
            this.time.delayedCall(2000, () => {
                if (bullet && bullet.active) bullet.destroy();
            });
        }
    }
}

function hitDrone(bullet, drone) {
    bullet.destroy();
    let droneX = drone.x;
    let droneY = drone.y;
    drone.destroy();

    let gem = gemsGroup.create(droneX, droneY, 'gem');
    gem.setScale(0.6);
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
    player.setTint(0xff0000);
    this.time.delayedCall(200, () => { player.clearTint(); });
}

function createLevelUpUI() {
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