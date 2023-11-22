const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moveSpeed = 5
const tileSize = 150;
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

let intervals = [];

let playerX = 450;
let playerY = 450;
let playerFacing = 0; // Angle player is facing, 0-359, 0 is North, 90 is E, 180 S, 270 W (clockwise)

let playerWeaknessDebuff = Math.floor(Math.random() * 4) + 1; // 0 = none, 1 = Front, 2 = Right, 3 = Back, 4 = Left
let playerRotateDebuff = 0; // 0 = none, 3 = fake drawRotated, 5 = real drawRotated

// Whether the player was facing the wrong way for the orb. Used for resetting stage if hit.
let hitByOrb = false;

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

// Returns the "quadrant" (Front/Right/Back/Left) that enemy is with relation to the direction of the player.
// 1 = enemy is in front of player, 2 = enemy is to right, 3 = back, 4 = left
// Useful for checking whether the player's "safe side" is pointed the correct way
// TODO can probably generalize this to also be used for the boss cleaves
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

// Returns the "quadrant" (Front/Right/Back/Left) that the coordinates otherObject is with relation to the position of centralObject.
// 1 = otherObject is in front of centralObject, 2 = otherObject is to right, 3 = back, 4 = left
// Useful for checking whether the player is on the boss aoe's "safe side"
// DOES NOT WORK FOR THE PLAYER BECAUSE THAT NEEDS PLAYER DIRECTION, NOT COORDINATES
// TODO can probably delete this function after generalizing the above function
function checkObjectDirection(centralObject, otherObject) {
    let otherObjectAngle = calculateAngle(otherObject.x, otherObject.y);
    let centralObjectAngle = calculateAngle(centralObject.x, centralObject.y);
    if (otherObjectAngle >= centralObjectAngle + 315 || otherObjectAngle < centralObjectAngle + 45) { // Front
        return 1;
    } else if (otherObjectAngle >= centralObjectAngle + 45 && otherObjectAngle < centralObjectAngle + 135) { // Right
        return 2;
    } else if (otherObjectAngle >= centralObjectAngle + 135 && otherObjectAngle < centralObjectAngle + 225) { // Back
        return 3;
    } else if (otherObjectAngle >= centralObjectAngle + 225 && otherObjectAngle < centralObjectAngle + 315) { // Back
        return 4;
    }
}

// Returns the angle, in degrees, of the (x, y) point, relative to the middle of the canvas. 0 degrees is up/north.
function calculateAngle(x, y){
    return radToDeg(Math.atan2(y - (canvasHeight/2), x - (canvasWidth/2))) + 90;
}

// Returns the angle, in degrees, of the (x, y) point, relative to the given reference point. 0 degrees is up/north.
function calculateAngleFromPoint(objectPoint, referencePoint){
    return radToDeg(Math.atan2(objectPoint.y - referencePoint.y, objectPoint.x - referencePoint.x)) + 90;
}

////////////////////
// INPUT HANDLERS //
////////////////////

function keyDownHandler(e) {
    if (e.key === "w") {
        playerY -= moveSpeed;
    } else if (e.key === "a") {
        playerX -= moveSpeed;
    } else if (e.key === "s") {
        playerY += moveSpeed;
    } else if (e.key === "d") {
        playerX += moveSpeed;
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

// Resets the game state
function reset(){
    playerX = 450;
    playerY = 450;
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

    stepCount = 0;

    hitByOrb = false;

    for (let i = 0; i < intervals.length; i++){
        clearInterval(intervals.pop());
    }

    intervals.push(setInterval(draw, 10));
    setTimeout(() => {
        intervals.push(setInterval(step, 1000));
    }, 5000);
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

function draw() {
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

    // Draw the player
    drawRotated(playerFacing, {x: playerX, y: playerY}, drawPlayer);
    drawPlayerWeaknessDebuff(playerWeaknessDebuff);

    // Perform checks if player has committed skill issue
    let playerTile = getPlayerTile();
    if (playerTile.x > 4 || playerTile.y > 4 || playerTile.x < 0 || playerTile. y < 0){
        alert ("You walled :(");
        reset()
    } else if (arena[playerTile.y][playerTile.x] === 6){
        alert ("You stood in the bad :(");
        reset()
    } else if (hitByOrb){
        alert("You didn't show hole to the orb :(");
        reset();
    }

    // Perform check if player has cleared
    if (stepCount > 10){
        alert("Congrats, you survived the mechanic :)");
        reset();
    }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("mousemove", mouseMoveHandler);

intervals.push(setInterval(draw, 10));
setTimeout(() => {
    intervals.push(setInterval(step, 1000));
}, 5000);