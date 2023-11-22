window.onload = function(){
    document.getElementById("begin").addEventListener("click", function(){
        switch (document.getElementById("mechanic-selector").value){
            case "aai-analysis":
                beginAnalysisArcaneArray();
                break;
            case "aai-spatial-tactics":
                console.log("AAI: Spatial Tactics");
                break;
        }
    })

    // Display default placeholder text before a mechanic is chosen
    // This will get overwritten when a mechanic is selected and loaded
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.font = "76px Calibri"
    ctx.fillText( "Select a mechanic...", 150, 450);
}

