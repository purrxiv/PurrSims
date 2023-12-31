const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moveSpeed = 2
const tileSize = 150;
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

const bossIcon = new Image();

let heldKey;

let intervals = [];
let timeouts = [];

let playerX = 450;
let playerY = 485;
let playerFacing = 0; // Angle player is facing, 0-359, 0 is North, 90 is E, 180 S, 270 W (clockwise)

let playerWeaknessDebuff = randomDirection(); // 0 = none, 1 = Front, 2 = Right, 3 = Back, 4 = Left
let playerRotationDebuff = randomRotationDebuff(); // 0 = none, 3 = fake drawRotated, 5 = real drawRotated

// Whether the player was facing the wrong way for the orb. Used for resetting stage if hit.
let hitByOrb = false;

// Whether the player was in the wrong quadrant for boss cleave. Used for resetting stage if hit.
let hitByCleave = false;

// Whether the player was facing the wrong way for the boss gaze/tether. Used for resetting stage if hit.
let hitByGaze = false;

// Represent the state of the arena.
// 0 = empty, 1 = up arrow, 2 = right, 3 = down, 4 = left, 5 = orb, 6 = blue/lit up/danger
let arena = [
    [2, 5, 0, 0, 3],
    [0, 0, 0, 0, 4],
    [0, 0, 0, 0, 0],
    [2, 0, 0, 0, 5],
    [1, 0, 0, 0, 4]
];

// Represent the next steps of the arena's mechanics.
// 1 = tile will go up next, 2 = right next, 3 = down, 4 = left
let arenaMechanics = [
    [2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 4]
];

// The currently pending boss cleave, or null if none active
let pendingBossCleave;

// The currently pending rotation of the player safe side, or null if none active
let pendingRotate;

// The number of mechanic steps
let stepCount = 0;

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

// Convert an angle from degrees to radians
function degToRad (degrees){
    return degrees * (Math.PI / 180);
}

// Convert an angle from radians to degrees
function radToDeg (radians) {
    return radians * (180 / Math.PI);
}

// Given a tile, return the canvas coordinates of the middle of the tile. (0, 0) is top left.
// Useful for drawing and for line-of-sight calculations to orbs.
function getTileMidCoords(x, y){
    return {
        x: 75+tileSize*x+75,
        y: 75+tileSize*y+75
    };
}

// Returns the array indices of the tile the player is currently standing in. (0, 0) is top left.
// Useful for checking if player is standing in the bad
function getPlayerTile(){
    return {
        x: Math.floor((playerX - 75) / 150),
        y: Math.floor((playerY - 75)  / 150)
    }
}

function randomDirection(){
    return Math.floor(Math.random() * 4) + 1;
}

function randomRotation(){
    return Math.random() >= 0.5;
}

function randomRotationDebuff(){
    const possibilities = [3,5];
    return possibilities[Math.floor(Math.random() * possibilities.length)];
}

// Returns the "quadrant" (Front/Right/Back/Left) that player is with relation to the boss (middle of arena).
// 1 = enemy is in front of player, 2 = enemy is to right, 3 = back, 4 = left
function checkBossDirection(player) {
    let playerPositionAngle = calculateAngleFromPoint({x: player.x, y: player.y}, {x:canvasWidth/2, y:canvasHeight/2});
    if (playerPositionAngle < 0){
        playerPositionAngle += 360;
    }
    if (playerPositionAngle < 45 || playerPositionAngle >= 315) { // Front
        return 1;
    } else if (playerPositionAngle >= 45 && playerPositionAngle < 135) { // Right
        return 2;
    } else if (playerPositionAngle >= 135 && playerPositionAngle < 225) { // Back
        return 3;
    } else if (playerPositionAngle >= 225 && playerPositionAngle < 315) { // Left
        return 4;
    }
}

// Returns the "quadrant" (Front/Right/Back/Left) that enemy is with relation to the direction of the player.
// 1 = enemy is in front of player, 2 = enemy is to right, 3 = back, 4 = left
// Useful for checking whether the player's "safe side" is pointed the correct way
function checkPlayerDirection(enemy) {
    let enemyAngle = calculateAngleFromPoint({x: enemy.x, y: enemy.y}, {x: playerX, y: playerY});
    enemyAngle -= playerFacing;
    if (enemyAngle < 0){
        enemyAngle += 360;
    }
    if (enemyAngle < 45 || enemyAngle >= 315) { // Front
        return 1;
    } else if (enemyAngle >= 45 && enemyAngle < 135) { // Right
        return 2;
    } else if (enemyAngle >= 135 && enemyAngle < 225) { // Back
        return 3;
    } else if (enemyAngle >= 225 && enemyAngle < 315) { // Left
        return 4;
    }
}

// Returns the angle, in degrees, of the (x, y) point, relative to the given reference point. 0 degrees is up/north.
function calculateAngleFromPoint(objectPoint, referencePoint){
    return radToDeg(Math.atan2(objectPoint.y - referencePoint.y, objectPoint.x - referencePoint.x)) + 90;
}

////////////////////
// INPUT HANDLERS //
////////////////////

function keyDownHandler(e) {
    if (e.key === "w" || e.key === "a" || e.key === "s" || e.key === "d") {
        heldKey = e.key;
    }
}

function keyUpHandler(e) {
    if (e.key === "w" || e.key === "a" || e.key === "s" || e.key === "d") {
        heldKey = null;
    }
}

function mouseMoveHandler(e){
    const bounds = canvas.getBoundingClientRect();
    const mouseCoords = { x: 0, y: 0 };
    mouseCoords.x = e.pageX - bounds.left;
    mouseCoords.y = e.pageY - bounds.top ;

    playerFacing = radToDeg(Math.atan2(mouseCoords.y - playerY, mouseCoords.x - playerX)) + 90;
}

////////////////////////
// MECHANIC FUNCTIONS //
////////////////////////

// Advance the arena's mechanics by one step.
function step() {
    let actionTiles = []; // List of tiles requiring action
    for (let i = 0; i < arenaMechanics.length; i++) {
        for (let j = 0; j < arenaMechanics[i].length; j++) {
            if (arenaMechanics[i][j] !== 0) {
                actionTiles.push({x: j, y: i});
            }
        }
    }

    for (let i = 0; i < actionTiles.length; i++) {
        let tileX = actionTiles[i].x;
        let tileY = actionTiles[i].y;
        if (arena[tileY][tileX] === 5) {
            if (!orbExplosion(tileX, tileY)) {
                hitByOrb = true;
            }
        }
        arena[tileY][tileX] = 6;
        setNextTile(tileX, tileY, arenaMechanics[tileY][tileX]);

        arenaMechanics[tileY][tileX] = 0;
    }

    stepCount++;
}

// Helper function for step()
function setNextTile(tileX, tileY, direction){
    switch (direction){
        case 1:
            tileY--;
            break;
        case 2:
            tileX++;
            break;
        case 3:
            tileY++;
            break;
        case 4:
            tileX--;
            break;
    }

    if (arena[tileY][tileX] === 0 || arena[tileY][tileX] === 5){
        arenaMechanics[tileY][tileX] = direction;
    } else {
        arenaMechanics[tileY][tileX] = arena[tileY][tileX];
    }
}

// Checks whether the player's weakness ring is appropriately faced for an exploding orb.
// Returns true if the player correctly resolved the mechanic, and returns false if not.
function orbExplosion(tileX, tileY){
    if (playerWeaknessDebuff === 0){
        return true;
    }
    return playerWeaknessDebuff === checkPlayerDirection(getTileMidCoords(tileX, tileY));
}

// Schedules a boss cleave with the specified 3 or 5 rotation to go off in a specified amount of time in milliseconds.
// telegraphDirection should be 1-4, for up right down left respectively
// rotationCount should be 3 or 5
// delay should be a time in milliseconds
function bossCleave(telegraphDirection, clockwise, rotationCount, delay){
    pendingBossCleave = {
        telegraphDirection: telegraphDirection,
        clockwise: clockwise,
        rotationCount: rotationCount,
    }

    timeouts.push(setTimeout(() =>{
        if (rotationCount === 3){
            clockwise = !clockwise;
        }

        if (clockwise){
            telegraphDirection++;
        } else {
            telegraphDirection--;
        }

        if (telegraphDirection === 5){
            telegraphDirection = 1;
        }

        if (telegraphDirection === 0){
            telegraphDirection = 4;
        }

        if (checkBossDirection({x: playerX, y: playerY}) !== telegraphDirection){
            hitByCleave = true;
        }
        pendingBossCleave = null;
    }, delay));
}

// Schedules a boss gaze and a player debuff rotation with the specified 3 or 5 rotation to go off in a specified amount of time in milliseconds.
// rotationCount should be 3 or 5
// delay should be a time in milliseconds
function bossGaze(clockwise, rotationCount, delay){
    pendingRotate = {
      clockwise: clockwise,
      rotationCount: rotationCount,
    };

    timeouts.push(setTimeout(() =>{
        if (rotationCount === 3){
            clockwise = !clockwise;
        }

        if (clockwise){
            playerWeaknessDebuff++;
        } else {
            playerWeaknessDebuff--;
        }

        if (playerWeaknessDebuff === 5){
            playerWeaknessDebuff = 1;
        }

        if (playerWeaknessDebuff === 0){
            playerWeaknessDebuff = 4;
        }

        if (!(playerWeaknessDebuff === checkPlayerDirection({x: canvasWidth/2, y: canvasHeight/2}))){
            hitByGaze = true;
        }
        pendingRotate = null;
    }, delay));
}

// Freezes the game state. Called on mechanic failure
function stopAnalysisArcaneArray() {
    hitByOrb = false;
    hitByCleave = false;
    hitByGaze = false;
    pendingBossCleave = null;
    pendingRotate = null;
    heldKey = null;

    for (let i = 0; i < intervals.length; i++){
        clearInterval(intervals.pop());
    }

    for (let i = 0; i < timeouts.length; i++){
        clearTimeout(timeouts.pop());
    }
}

// Resets the game state and starts a run
function beginAnalysisArcaneArray(){
    stopAnalysisArcaneArray();
    playerX = 450;
    playerY = 485;
    playerFacing = 0;

    arena = [
        [2, 5, 0, 0, 3],
        [0, 0, 0, 0, 4],
        [0, 0, 0, 0, 0],
        [2, 0, 0, 0, 5],
        [1, 0, 0, 0, 4]
    ];

    arenaMechanics = [
        [2, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 4]
    ];

    playerWeaknessDebuff = Math.floor(Math.random() * 4) + 1
    playerRotationDebuff = randomRotationDebuff();

    stepCount = 0;

    intervals.push(setInterval(draw, 10));

    timeouts.push(setTimeout(() => {
        intervals.push(setInterval(step, 1200));
    }, 5000));

    timeouts.push(setTimeout(() => {
        bossCleave(randomDirection(), randomRotation(), randomRotationDebuff(), 6000);
    }, 5000 + (3 * 1200)));

    timeouts.push(setTimeout(() => {
        bossGaze(randomRotation(), randomRotationDebuff(), 6000 + 8000);
    }, 5000 + (3 * 1200) - 2000));

    heldKey = null;
}

////////////////////
// DRAW FUNCTIONS //
////////////////////
function drawRotated(degree,rotatePoint,drFunc) {
    ctx.save();
    rotatePoint = rotatePoint || {x:canvasWidth/2,y:canvasHeight/2};

    // Move registration point to the center of the canvas
    ctx.translate(rotatePoint.x, rotatePoint.y);

    // Rotate
    ctx.rotate(degToRad(degree));

    // Move registration point back to the top left corner of canvas
    ctx.translate(-rotatePoint.x, -rotatePoint.y);

    drFunc();
    ctx.restore();
}

// Given tile X and Y coordinates, draw an up arrow on that tile. (0, 0) is top left.
function drawUpArrow(tileX, tileY){
    let drawingCoords = getTileMidCoords(tileX, tileY);
    ctx.beginPath();
    ctx.moveTo(drawingCoords.x - (tileSize / 3), drawingCoords.y + (tileSize / 5));
    ctx.lineTo(drawingCoords.x, drawingCoords.y - (tileSize / 5));
    ctx.lineTo(drawingCoords.x + (tileSize / 3), drawingCoords.y + (tileSize / 5));
    ctx.strokeStyle = "rgba(255, 212, 128, 1)";
    ctx.lineWidth = 7;
    ctx.stroke();
}

// Given tile X and Y coordinates, draw a right arrow on that tile. (0, 0) is top left.
function drawRightArrow(tileX, tileY){
    let drawingCoords = getTileMidCoords(tileX, tileY);
    ctx.beginPath();
    ctx.moveTo(drawingCoords.x - (tileSize / 5), drawingCoords.y - (tileSize / 3));
    ctx.lineTo(drawingCoords.x + (tileSize /5), drawingCoords.y);
    ctx.lineTo(drawingCoords.x - (tileSize / 5), drawingCoords.y + (tileSize / 3));
    ctx.strokeStyle = "rgba(255, 212, 128, 1)"
    ctx.lineWidth = 7;
    ctx.stroke();
}

// Given tile X and Y coordinates, draw a down arrow on that tile. (0, 0) is top left.
function drawDownArrow(tileX, tileY){
    let drawingCoords = getTileMidCoords(tileX, tileY);
    ctx.beginPath();
    ctx.moveTo(drawingCoords.x - (tileSize / 3), drawingCoords.y - (tileSize / 5));
    ctx.lineTo(drawingCoords.x, drawingCoords.y + (tileSize / 5));
    ctx.lineTo(drawingCoords.x + (tileSize / 3), drawingCoords.y - (tileSize / 5));
    ctx.strokeStyle = "rgba(255, 212, 128, 1)";
    ctx.lineWidth = 7;
    ctx.stroke();
}

// Given tile X and Y coordinates, draw a left arrow on that tile. (0, 0) is top left.
function drawLeftArrow(tileX, tileY){
    let drawingCoords = getTileMidCoords(tileX, tileY);
    ctx.beginPath();
    ctx.moveTo(drawingCoords.x + (tileSize / 5), drawingCoords.y - (tileSize / 3));
    ctx.lineTo(drawingCoords.x - (tileSize /5), drawingCoords.y);
    ctx.lineTo(drawingCoords.x + (tileSize / 5), drawingCoords.y + (tileSize / 3));
    ctx.strokeStyle = "rgba(255, 212, 128, 1)"
    ctx.lineWidth = 7;
    ctx.stroke();
}

function drawPlayer(){
    ctx.fillStyle = "rgba(93, 138, 168, 1)";
    ctx.beginPath();
    ctx.moveTo(playerX, playerY - 10);
    ctx.lineTo(playerX + 10, playerY + 20);
    ctx.lineTo(playerX - 10, playerY + 20);
    ctx.closePath();
    ctx.fill();
}

function drawPlayerWeaknessDebuff(debuff){
    if (debuff === 0){
        return;
    }
    debuff -= 1;
    let endAngle = degToRad(playerFacing - 90 - 45) + degToRad(90 * debuff);
    let startAngle = degToRad(playerFacing - 90 + 45) + degToRad(90 * debuff);


    ctx.beginPath();
    ctx.strokeStyle = "rgba(252, 125, 0, 1)";
    ctx.lineWidth = 25;
    ctx.arc(playerX, playerY, 50, startAngle, endAngle, false);
    ctx.stroke();

}

function drawBossCleave(direction, clockwise, rotationCount){
    direction -= 1;
    let endAngle = degToRad(0 - 90  - 45 + 90*direction);
    let startAngle = degToRad(0 - 90  + 45 + 90*direction);

    ctx.beginPath();
    ctx.fillStyle = "rgba(139, 0, 0, 0.5)";
    ctx.moveTo(canvasWidth / 2, canvasHeight / 2);
    ctx.arc(canvasWidth / 2, canvasHeight / 2, 450, startAngle, endAngle, false);
    ctx.lineTo(canvasWidth / 2, canvasHeight / 2);
    ctx.fill();

    // let drawingXCoord = 3 * canvasWidth / 4 + tileSize / 2;
    let drawingXCoord = canvasWidth /2;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(256, 87, 87, 1)";
    ctx.lineWidth = 5;
    ctx.arc(drawingXCoord, canvasHeight / 2, 35, Math.PI, 0, false);
    ctx.arc(drawingXCoord, canvasHeight / 2, 35, 0, Math.PI, false);

    ctx.font = "48px Calibri";
    ctx.fillStyle = "rgba(256, 87, 87, 1)";
    ctx.fillText(rotationCount, drawingXCoord - 10, canvasHeight / 2 + 15);

    if (clockwise){
        ctx.moveTo( drawingXCoord + 35 - 10, canvasHeight / 2 - 15);
        ctx.lineTo(drawingXCoord + 35, canvasHeight / 2);
        ctx.lineTo(drawingXCoord + 35 + 10, canvasHeight / 2 - 15);

        ctx.moveTo(drawingXCoord - 35 - 10, canvasHeight / 2 + 15);
        ctx.lineTo(drawingXCoord - 35, canvasHeight / 2);
        ctx.lineTo(drawingXCoord - 35 + 10, canvasHeight / 2 + 15);
    } else { // counterclockwise
        ctx.moveTo(drawingXCoord + 35 - 10, canvasHeight / 2 + 15);
        ctx.lineTo(drawingXCoord + 35, canvasHeight / 2);
        ctx.lineTo(drawingXCoord + 35 + 10, canvasHeight / 2 + 15);

        ctx.moveTo(drawingXCoord - 35 - 10, canvasHeight / 2 - 15);
        ctx.lineTo(drawingXCoord - 35, canvasHeight / 2);
        ctx.lineTo(drawingXCoord - 35 + 10, canvasHeight / 2 - 15);
    }
    ctx.stroke();
}

function drawPlayerRotate(clockwise, rotationCount){
    ctx.beginPath();
    ctx.strokeStyle = "rgba(93, 138, 168, 1)";
    ctx.lineWidth = 5;
    ctx.arc(playerX, playerY, 35, Math.PI, 0, false);
    ctx.arc(playerX, playerY, 35, 0, Math.PI, false);

    ctx.font = "48px Calibri";
    ctx.fillStyle = "rgba(93, 138, 168, 1)";
    ctx.fillText(rotationCount, playerX - 10, playerY);

    if (clockwise){
        ctx.moveTo( playerX + 35 - 10, playerY - 15);
        ctx.lineTo(playerX + 35, playerY);
        ctx.lineTo(playerX + 35 + 10, playerY - 15);

        ctx.moveTo(playerX - 35 - 10, playerY + 15);
        ctx.lineTo(playerX - 35, playerY);
        ctx.lineTo(playerX - 35 + 10, playerY + 15);
    } else { // counterclockwise
        ctx.moveTo(playerX + 35 - 10, playerY + 15);
        ctx.lineTo(playerX + 35, playerY);
        ctx.lineTo(playerX + 35 + 10, playerY + 15);

        ctx.moveTo(playerX - 35 - 10, playerY - 15);
        ctx.lineTo(playerX - 35, playerY);
        ctx.lineTo(playerX - 35 + 10, playerY - 15);
    }
    ctx.stroke();
}

function draw() {
    if (heldKey){
        switch (heldKey){
            case "w":
                playerY -= moveSpeed;
                break;
            case "a":
                playerX -= moveSpeed;
                break;
            case "s":
                playerY += moveSpeed;
                break;
            case "d":
                playerX += moveSpeed;
                break;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas on each frame
    // Draw arena background/fill
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(179, 119, 0, 1)";
    ctx.fill();

    // Draw arena hazards/items
    for (let i = 0; i < 5; i++){
        for (let j = 0; j < 5; j++){
            switch (arena[i][j]) {
                case 0:
                    break;
                case 1:
                    drawUpArrow(j, i);
                    break;
                case 2:
                    drawRightArrow(j, i)
                    break;
                case 3:
                    drawDownArrow(j, i);
                    break;
                case 4:
                    drawLeftArrow(j, i);
                    break;
                case 5: // Orb
                    ctx.beginPath();
                    let coords = getTileMidCoords(j, i);
                    ctx.arc(coords.x, coords.y, 50, 0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(204, 255, 255)";
                    ctx.fill();
                    break;
                case 6: // Danger tile
                    ctx.beginPath();
                    ctx.rect(75 + tileSize * j, 75 + tileSize * i, tileSize - 2.5, tileSize - 2.5);
                    ctx.fillStyle = "rgba(0, 102, 255, 1)";
                    ctx.fill();
                    break;
            }
        }
    }
    ctx.closePath();

    // Draw the starting telegraphs
    ctx.beginPath();
    if (stepCount === 0){
        for (let i = 0; i < arenaMechanics.length; i++){
            for (let j = 0; j < arenaMechanics[i].length; j++){
                if (arenaMechanics[i][j] !== 0) {
                    ctx.rect(75+5+tileSize*i, 75+5+tileSize*j, tileSize-10, tileSize-10);
                }
            }
        }
        ctx.strokeStyle = "rgba(0, 102, 255, 1)";
        ctx.stroke();
    }

    // Draw the arena tiles
    ctx.beginPath();
    for (let i = 0; i < 5; i++){
        for (let j = 0; j < 5; j++){
            ctx.rect(75+tileSize*i, 75+tileSize*j, tileSize, tileSize);
            // Top left of grid is (75, 75)
        }
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.closePath();

    // Draw the boss icon
    ctx.beginPath();
    ctx.drawImage(bossIcon, canvasWidth / 2 - 25, canvasHeight / 2 - 25);

    // Draw the player
    drawRotated(playerFacing, {x: playerX, y: playerY}, drawPlayer);
    drawPlayerWeaknessDebuff(playerWeaknessDebuff);

    // Perform checks if player has committed skill issue
    let playerTile = getPlayerTile();
    if (playerTile.x > 4 || playerTile.y > 4 || playerTile.x < 0 || playerTile. y < 0){
        if(confirm ("You walled :(\nClick OK to retry, or Cancel to stop and choose another mechanic.")){
            beginAnalysisArcaneArray();
        } else {
            stopAnalysisArcaneArray();
        }
    } else if (arena[playerTile.y][playerTile.x] === 6){
        if(confirm ("You got floorfucked :(\nClick OK to retry, or Cancel to stop and choose another mechanic.")){
            beginAnalysisArcaneArray();
        } else {
            stopAnalysisArcaneArray();
        }
    } else if (hitByOrb){
        if(confirm ("You didn't show hole to the orb :(\nClick OK to retry, or Cancel to stop and choose another mechanic.")){
            beginAnalysisArcaneArray();
        } else {
            stopAnalysisArcaneArray();
        }
    } else if (hitByCleave){
        if(confirm ("You got hit by the boss's cleave :(\nClick OK to retry, or Cancel to stop and choose another mechanic.")){
            beginAnalysisArcaneArray();
        } else {
            stopAnalysisArcaneArray();
        }
    } else if (hitByGaze){
        if(confirm ("You didn't show hole to the boss :(\nClick OK to retry, or Cancel to stop and choose another mechanic.")){
            beginAnalysisArcaneArray();
        } else {
            stopAnalysisArcaneArray();
        }
    }

    // Perform check if player has cleared
    if (stepCount > 14){
        if(confirm ("Congrats, you survived the mechanic :)\nClick OK to go again, or Cancel to stop and choose another mechanic.")){
            beginAnalysisArcaneArray();
        } else {
            stopAnalysisArcaneArray();
        }
    }
    if (pendingBossCleave){
        drawBossCleave(pendingBossCleave.telegraphDirection, pendingBossCleave.clockwise, pendingBossCleave.rotationCount);
    }

    if (pendingRotate){
        drawPlayerRotate(pendingRotate.clockwise, pendingRotate.rotationCount);
    }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
document.addEventListener("mousemove", mouseMoveHandler);

bossIcon.src = "img/boss.png";