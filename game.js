const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const moveSpeed = 5

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

// Convert an angle from radians to degrees
function radToDeg (radians) {
    return radians * (180 / Math.PI);
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
    drawPlayerWeaknessDebuff(playerWeaknessDebuff);1

    // playerFacing++;
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("mousemove", mouseMoveHandler);
canvas.addEventListener('mousedown', function(e) {
    clickHandler(canvas, e);
});

setInterval(draw, 10);