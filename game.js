const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let canvasWidth = 900;
let canvasHeight = 900;

let playerX = 450;
let playerY = 450;
let playerFacing = 0; // Angle player is facing, 0-359, 0 is North, 90 is E, 180 S, 270 W (clockwise)

let playerWeaknessDebuff = 1; // 0 = none, 1 = Front, 2 = Right, 3 = Back, 4 = Left
let playerRotateDebuff = 0; // 0 = none, 3 = fake drawRotated, 5 = real drawRotated

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

// Convert an angle from degrees to radians
function degToRad (degrees){
    return degrees * (Math.PI / 180);
}

function radToDeg (radians) {
    return radians * (180 / Math.PI);
}

// Calculate angle between points, in radians. B is the center point.
function calculateAngle(a, b, c) {
    let AB = Math.sqrt(Math.pow(b.x-a.x,2)+ Math.pow(b.y-a.y,2));
    let BC = Math.sqrt(Math.pow(b.x-c.x,2)+ Math.pow(b.y-c.y,2));
    let AC = Math.sqrt(Math.pow(c.x-a.x,2)+ Math.pow(c.y-a.y,2));
    return Math.acos((BC*BC+AB*AB-AC*AC)/(2*BC*AB));
}

// Given coordinates, angle, and distance, find point at that distance away, at that angle.
function findNewPoint(x, y, angle, distance) {
    let result = {};

    result.x = Math.round(Math.cos(degToRad(angle) + 90) * distance + x);
    result.y = Math.round(Math.sin(degToRad(angle) + 90) * distance + y);

    return result;
}

////////////////////
// INPUT HANDLERS //
////////////////////

function clickHandler(canvas, event){
    const rect = canvas.getBoundingClientRect()
    let clickCoords = {x: event.clientX - rect.left, y: event.clientY - rect.top};
    let playerCoords = {x: playerX, y: playerY};
    let playerFacingCoords = findNewPoint(playerX, playerY, playerFacing, 20); //TODO something is making this break

    playerFacing = radToDeg(calculateAngle( clickCoords, playerCoords, playerFacingCoords));
    console.log(playerFacingCoords.x, playerFacingCoords.y);
    console.log(playerFacing);
    // console.log("x: " + clickX + " y: " + clickY);
}

////////////////////
// DRAW FUNCTIONS //
////////////////////
function drawRotated(degree,rotatePoint,drFunc) {
    ctx.save();
    rotatePoint = rotatePoint || {x:canvasWidth/2,y:canvasHeight/2};
    // Clear the canvas
    // ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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
    let startAngle = degToRad(playerFacing - 90 - 45) + degToRad(90 * debuff);
    let endAngle = degToRad(playerFacing - 90 + 45) + degToRad(90 * debuff);

    ctx.beginPath()
    ctx.strokeStyle = "rgba(252, 125, 0, 1)";
    ctx.lineWidth = 25;
    ctx.arc(playerX, playerY, 50, startAngle, endAngle, true);
    ctx.stroke();

}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas on each frame

    drawRotated(playerFacing, {x: playerX, y: playerY}, drawPlayer);
    drawPlayerWeaknessDebuff(playerWeaknessDebuff);
    // drawRotated(playerFacing, {x: playerX, y: playerY}, function (){drawPlayerWeaknessDebuff(playerWeaknessDebuff)});
}

canvas.addEventListener('mousedown', function(e) {
    clickHandler(canvas, e);
});

setInterval(draw, 10);