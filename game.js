const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moveSpeed = 5
const tileSize = 150;
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

let playerX = 450;
let playerY = 450;
let playerFacing = 0; // Angle player is facing, 0-359, 0 is North, 90 is E, 180 S, 270 W (clockwise)

let playerWeaknessDebuff = 1; // 0 = none, 1 = Front, 2 = Right, 3 = Back, 4 = Left
let playerRotateDebuff = 0; // 0 = none, 3 = fake drawRotated, 5 = real drawRotated

// Represent the state of the arena.
// 0 = empty, 1 = up arrow, 2 = right, 3 = down, 4 = left, 5 = orb, 6 = blue/lit up/danger
let arena = [
    [6, 0, 0, 5, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 6, 0],
    [5, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
];

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
    } else if (e.key === "1"){
        let orb = getTileMidCoords(0, 3);
        switch (checkPlayerDirection(orb)){
            case 1:
                console.log("Front");
                break;
            case 2:
                console.log("Right");
                break;
            case 3:
                console.log("Back");
                break;
            case 4:
                console.log("Left");
                break;
        }

    }
}

function mouseMoveHandler(e){
    const bounds = canvas.getBoundingClientRect();
    const mouseCoords = { x: 0, y: 0 };
    mouseCoords.x = e.pageX - bounds.left;
    mouseCoords.y = e.pageY - bounds.top ;

    playerFacing = radToDeg(Math.atan2(mouseCoords.y - playerY, mouseCoords.x - playerX)) + 90;
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
                    break; // TODO
                case 2:
                    break; // TODO
                case 3:
                    break; // TODO
                case 4:
                    break; // TODO
                case 5: // Orb
                    ctx.beginPath();
                    let coords = getTileMidCoords(i, j);
                    ctx.arc(coords.x, coords.y, 50, 0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(204, 255, 255)";
                    ctx.fill();
                    break;
                case 6: // Danger tile
                    ctx.beginPath();
                    ctx.rect(75 + tileSize * i, 75 + tileSize * j, tileSize - 2.5, tileSize - 2.5);
                    ctx.fillStyle = "rgba(0, 102, 255, 1)";
                    ctx.fill();
                    break;
            }
        }
    }
    ctx.closePath();

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
        playerX = 450;
        playerY = 450;
    } else if (arena[playerTile.x][playerTile.y] === 6){
        alert ("You stood in the bad :(");
        playerX = 450;
        playerY = 450;
    }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("mousemove", mouseMoveHandler);
setInterval(draw, 10);