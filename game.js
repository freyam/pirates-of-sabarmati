import "./style.css";

import * as THREE from "three";

import { Water } from "three/examples/jsm/objects/Water.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let gameState = "GAME_LOADING";
let gameAlert = "";

let camera, scene, renderer, HUD, water, sun;
let cameraModes = ["First Person", "Third Person", "Bird's Eye"];
let cameraModeIDX = 1;

let chestsLootedText,
    boatsDestroyedText,
    timeText,
    healthText,
    boostText,
    ammoText,
    shipPositionText,
    shipRotationText,
    distanceTravelledText;

let timeElapsed = 0;
let boatsDestroyed = false,
    chestsLooted = false;

const SHIP_SPEED = 1.5;
const BOAT_SPEED = 1.0;
const DIMENSION = 100000;

let CHESTS_LOOTED = 0;
let BOATS_DESTROYED = 0;

let ship,
    chests = [],
    N_CHESTS = 10,
    diamonds = [],
    N_DIAMONDS = N_CHESTS,
    boats = [],
    N_BOATS = 5,
    N_CANNONBALLS = N_BOATS * 10;

let dummyModel = null;

const oceanAudio = new Audio("sounds/ocean.mp3");
const chestAudio = new Audio("sounds/chest.mp3");
const shipAudio = new Audio("sounds/ship.mp3");
const firingAudio = new Audio("sounds/firing.mp3");
const reelingAudio = new Audio("sounds/reeling.mp3");

shipAudio.loop = true;
shipAudio.volume = 0.5;
let isPlayingShipAudio = false;

const loader = new GLTFLoader();
class Ship {
    constructor() {
        loader.load("textures/ship/scene.gltf", (gltf) => {
            const ship = gltf.scene;

            ship.scale.set(4, 4, 4);
            ship.position.set(0, -60, 0);
            ship.rotation.y = (90 * Math.PI) / 180;

            scene.add(ship);

            this.ship = ship;
            this.speed = {
                velocity: 0,
                rotation: 0,
            };
            this.movement = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                boost: false,
            };

            this.artillery = [];
            this.loadArtillery();

            this.health = 100;
            this.boost = 100;

            this.distanceTravelled = 0.0;

            this.isDestroyed = false;
        });
    }

    update() {
        if (this.ship) {
            if (this.movement.forward) {
                this.speed.velocity = SHIP_SPEED;
            } else if (!this.movement.backward) {
                this.speed.velocity = 0;
            }

            if (this.movement.backward) {
                this.speed.velocity = -SHIP_SPEED;
            } else if (!this.movement.forward) {
                this.speed.velocity = 0;
            }

            if (this.movement.left) {
                this.speed.rotation = 0.025;
            } else if (!this.movement.right) {
                this.speed.rotation = 0;
            }

            if (this.movement.right) {
                this.speed.rotation = -0.025;
            } else if (!this.movement.left) {
                this.speed.rotation = 0;
            }

            if (this.movement.backward) this.speed.rotation *= -1;

            if (this.movement.boost && this.boost > 0) {
                if (this.movement.forward || this.movement.backward) {
                    this.speed.velocity = this.speed.velocity * 2.5;
                    this.boost -= 0.5;
                }
                if (this.movement.left || this.movement.right) {
                    this.speed.rotation = this.speed.rotation * 2.5;
                    this.boost -= 0.5;
                }
            } else if (!this.movement.boost && this.boost < 100) {
                this.boost += 0.25;
            }

            this.ship.rotation.y += this.speed.rotation;
            this.ship.translateX(this.speed.velocity);

            this.distanceTravelled += this.speed.velocity;

            camera.rotation.y += this.speed.rotation;
            camera.translateX(this.speed.velocity);
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    loadArtillery() {
        if (this.artillery.length < N_CANNONBALLS / 2) {
            const cannonball = new THREE.Mesh(
                new THREE.SphereGeometry(4, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x2200b1 })
            );

            while (this.artillery.length < N_CANNONBALLS / 2) {
                this.artillery.push(cannonball);
            }
        }
    }

    shoot(boats) {
        if (this.artillery.length > 0) {
            const cannonball = this.artillery.pop();
            cannonball.position.set(
                this.ship.position.x,
                20,
                this.ship.position.z
            );
            cannonball.rotation.y = this.ship.rotation.y;

            scene.add(cannonball);
            firingAudio.play();
            firingAudio.volume = 0.5;

            const cannonballSpeed = 1;

            const cannonballInterval = setInterval(() => {
                cannonball.translateX(cannonballSpeed);

                let list_of_boat_healths = [];

                for (let i = 0; i < boats.length; i++) {
                    list_of_boat_healths.push(boats[i].health);
                    if (isColliding(cannonball, boats[i].boat)) {
                        if (boats[i].hit() == "boat_destroyed") {
                            scene.remove(cannonball);
                            scene.remove(boats[i].boat);

                            boats.splice(i, 1);
                            BOATS_DESTROYED++;
                            i--;

                            clearInterval(cannonballInterval);
                        }
                    }
                }

                let distance = Math.sqrt(
                    Math.pow(cannonball.position.x - this.ship.position.x, 2) +
                        Math.pow(
                            cannonball.position.z - this.ship.position.z,
                            2
                        )
                );

                if (distance > 1000) {
                    scene.remove(cannonball);
                    clearInterval(cannonballInterval);
                }
            });
        }
    }

    hit() {
        this.health -= 20;
        if (this.health <= 0) {
            this.health = 0;
            return "ship_destroyed";
        }
    }

    reset() {
        this.health = 100;
        this.boost = 100;
        this.distanceTravelled = 0.0;
        this.isDestroyed = false;

        this.loadArtillery();

        this.ship.position.set(0, -60, 0);
        this.ship.rotation.y = (90 * Math.PI) / 180;
        this.ship.visible = true;

        scene.add(this.ship);
    }

    hide() {
        this.ship.visible = !this.ship.visible;
    }

    remove() {
        scene.remove(this.ship);
    }
}

class Boat {
    constructor(GLTFscene) {
        const boat = GLTFscene;

        let max = DIMENSION / 50;
        let min = -DIMENSION / 50;

        let randomX = 0;
        let randomZ = 0;

        while (randomX <= DIMENSION / 500 && randomZ <= DIMENSION / 500) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
            randomZ = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        boat.scale.set(0.05, 0.05, 0.05);
        boat.position.set(randomX, 0, randomZ);
        boat.rotation.y = (90 * Math.PI) / 180;

        scene.add(boat);

        this.boat = boat;

        this.speed = {
            velocity: 0,
            rotation: 0,
        };

        this.movement = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };

        this.health = 100;
        this.artillery = [];
        this.loadArtillery();

        this.isColliding = false;
    }

    update(ship) {
        if (this.health == 0) this.remove();

        let boatPosition = this.boat.position;
        let shipPosition = ship.ship.position;

        let x = shipPosition.x - boatPosition.x;
        let z = shipPosition.z - boatPosition.z;

        let boatAngle = Math.PI - Math.atan2(z, x);

        this.boat.rotation.y = boatAngle;

        if (Math.abs(x) < DIMENSION / 1000 && Math.abs(z) < DIMENSION / 1000) {
            return;
        }

        if (shipPosition.x > boatPosition.x) this.boat.position.x += 0.5;
        if (shipPosition.x < boatPosition.x) this.boat.position.x -= 0.5;
        if (shipPosition.z > boatPosition.z) this.boat.position.z += 0.5;
        if (shipPosition.z < boatPosition.z) this.boat.position.z -= 0.5;

        let shipHealth = ship.health;

        if (Math.abs(x) < DIMENSION / 1000 || Math.abs(z) < DIMENSION / 1000) {
            if (Math.random() < 0.0025) this.shoot(shipHealth);
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    loadArtillery() {
        if (this.artillery.length < N_CANNONBALLS) {
            const cannonball = new THREE.Mesh(
                new THREE.SphereGeometry(4, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xb12200 })
            );

            while (this.artillery.length < N_CANNONBALLS) {
                this.artillery.push(cannonball);
            }
        }
    }

    shoot(shipHealth) {
        if (this.artillery.length > 0 && shipHealth > 0 && timeElapsed > 1000) {
            const cannonball = this.artillery.pop();
            cannonball.position.set(
                this.boat.position.x,
                10,
                this.boat.position.z
            );
            cannonball.rotation.y = this.boat.rotation.y;

            scene.add(cannonball);
            firingAudio.play();
            firingAudio.volume = 0.5;

            const cannonballSpeed = 0.5;

            const cannonballInterval = setInterval(() => {
                cannonball.translateX(-cannonballSpeed);

                if (isColliding(cannonball, ship.ship)) {
                    if (ship.hit() == "ship_destroyed") {
                        scene.remove(cannonball);
                        scene.remove(ship.ship);

                        ship.isDestroyed = true;

                        clearInterval(cannonballInterval);
                    }
                }
            });
        }
    }

    hit() {
        this.health -= 20;
        if (this.health <= 0) {
            this.health = 0;
            return "boat_destroyed";
        }
    }

    remove() {
        scene.remove(this.boat);
    }
}

class Chest {
    constructor(GLTFscene) {
        const chest = GLTFscene;

        let max = DIMENSION / 25;
        let min = -DIMENSION / 25;

        let randomX = 0;
        let randomZ = 0;

        while (randomX <= DIMENSION / 500 && randomZ <= DIMENSION / 500) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
            randomZ = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        chest.scale.set(20, 20, 20);
        chest.position.set(randomX, 0, randomZ);

        scene.add(chest);

        this.chest = chest;
    }

    update() {
        if (this.chest) {
            this.chest.rotation.y += 0.05;
        }
    }

    remove() {
        scene.remove(this.chest);
    }
}

class Diamond {
    constructor(GLTFscene, chestPosition) {
        const diamond = GLTFscene;

        diamond.scale.set(0.75, 0.75, 0.75);
        diamond.position.set(
            chestPosition.x,
            chestPosition.y + 100,
            chestPosition.z
        );

        scene.add(diamond);

        this.diamond = diamond;
        this.isColliding = false;
    }

    update(chestPosition) {
        if (this.diamond) {
            this.diamond.rotation.y += 0.05;
        }

        if (this.isColliding) {
            this.diamond.position.y -= 0.5;
            reelingAudio.play();
            reelingAudio.volume = 0.5;
        } else {
            if (this.diamond.position.y == chestPosition.y + 100) return;
            this.diamond.position.y += 0.5;
        }

        if (this.diamond.position.y == chestPosition.y + 30) {
            CHESTS_LOOTED += 1;

            reelingAudio.pause();
            chestAudio.play();

            this.isColliding = false;

            return "chest_looted";
        }

        return "chest_not_looted";
    }

    remove() {
        scene.remove(this.diamond);
    }
}

async function loadModel(URI) {
    return new Promise((resolve, reject) => {
        loader.load(URI, (gltf) => {
            resolve(gltf.scene);
        });
    });
}

async function createChest() {
    if (!dummyModel) dummyModel = await loadModel("textures/chest/scene.gltf");
    return new Chest(dummyModel.clone());
}

async function createDiamond(chestPosition) {
    if (!dummyModel)
        dummyModel = await loadModel("textures/diamond/scene.gltf");
    return new Diamond(dummyModel.clone(), chestPosition);
}

async function createBoat() {
    if (!dummyModel) dummyModel = await loadModel("textures/boat/scene.gltf");
    return new Boat(dummyModel.clone());
}

function createPage(divID, imagePath) {
    const page = document.createElement("div");
    page.id = divID;
    page.style.position = "absolute";
    page.style.top = "0";
    page.style.left = "0";
    page.style.width = "100%";
    page.style.height = "100vh";
    page.style.backgroundImage = "url(" + imagePath + ")";
    page.style.backgroundSize = "cover";
    page.style.backgroundPosition = "center";
    page.style.display = "none";

    return page;
}

let banner = createPage("banner", "assets/images/banner-white.png");
banner.style.display = "block";
banner.style.backgroundColor = "black";
document.body.appendChild(banner);

banner = document.getElementById("banner");
let color = "black";
let isBlack = true;

let intervalID = setInterval(() => {
    color = isBlack
        ? "#" + Math.floor(Math.random() * 16777215).toString(16)
        : "black";
    isBlack = !isBlack;
    banner.style.transition = "background-color 2s ease";
    banner.style.backgroundColor = color;
}, 1000);

function loadGame(event) {
    if (event.key == " " || event.key == "Enter") {
        clearInterval(intervalID);
        banner.style.backgroundImage = "url(assets/images/banner.png)";
        banner.style.transition =
            "background-image 2s ease, background-color 3s";
        banner.style.backgroundColor = "black";
    }

    setTimeout(() => {
        init();
        document.getElementById("banner").remove();
        render();
        animate();
    }, 3000);
}

document.addEventListener("keydown", loadGame);

let loseDIV = createPage("lose-screen", "assets/states/GAME_LOSE.png");
let pauseDIV = createPage("pause-screen", "assets/states/GAME_PAUSE.png");
let winDIV = createPage("win-screen", "assets/states/GAME_WIN.png");
let overDIV = createPage("over-screen", "assets/states/GAME_OVER.png");

document.body.appendChild(pauseDIV);
document.body.appendChild(overDIV);
document.body.appendChild(winDIV);
document.body.appendChild(loseDIV);

async function init() {
    HUD = document.createElement("div");
    HUD.id = "hud-top";
    HUD.style.padding = "10px";
    HUD.style.display = "block";
    HUD.style.color = "#121212";
    HUD.style.position = "absolute";
    HUD.style.top = "0";
    HUD.style.left = "0";
    HUD.style.fontSize = "15px";
    document.body.appendChild(HUD);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        precision: "highp",
        depth: true,
        stencil: true,
        premultipliedAlpha: true,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.id = "sabarmati";

    //

    scene = new THREE.Scene();

    const FOV = 60;
    const ASPECT = window.innerWidth / window.innerHeight;
    const NEAR = 0.1;
    const FAR = 2000;

    camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
    camera.position.set(0, 50, 100);

    sun = new THREE.Vector3();

    // Water

    const waterGeometry = new THREE.PlaneGeometry(DIMENSION, DIMENSION);

    water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load(
            "textures/ocean/ocean.jpg",
            function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }
        ),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xf0f0f0,
        waterColor: 0x001e0f,
        distortionScale: 1,
        fog: scene.fog !== undefined,
    });

    water.rotation.x = -Math.PI / 2;

    scene.add(water);

    if (water) {
        oceanAudio.play();
        oceanAudio.loop = true;
        oceanAudio.volume = 0.1;
    }

    // Skybox

    const sky = new Sky();
    sky.scale.setScalar(DIMENSION);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;

    skyUniforms["turbidity"].value = 10;
    skyUniforms["rayleigh"].value = 2;
    skyUniforms["mieCoefficient"].value = 0.001;
    skyUniforms["mieDirectionalG"].value = 0.8;

    const parameters = {
        elevation: 10,
        azimuth: 100,
    };

    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms["sunPosition"].value.copy(sun);
    water.material.uniforms["sunDirection"].value.copy(sun).normalize();

    scene.environment = pmremGenerator.fromScene(sky).texture;

    //

    ship = new Ship();

    for (let i = 0; i < N_CHESTS; i++) {
        const chest = await createChest();
        chests.push(chest);
    }

    dummyModel = null;

    for (let i = 0; i < N_BOATS; i++) {
        const boat = await createBoat();
        boats.push(boat);
    }

    dummyModel = null;

    for (let i = 0; i < N_DIAMONDS; i++) {
        const diamond = await createDiamond(chests[i].chest.position);
        diamonds.push(diamond);
    }

    //

    window.addEventListener("resize", function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function keydown(event) {
        const key = event.key;

        if (key == "ArrowUp" || key == "w") {
            ship.movement.forward = true;
        }

        if (key == "ArrowDown" || key == "s") {
            ship.movement.backward = true;
        }

        if (key == "ArrowLeft" || key == "a") {
            ship.movement.left = true;
        }

        if (key == "ArrowRight" || key == "d") {
            ship.movement.right = true;
        }

        if (key == "b") {
            ship.movement.boost = true;
        }

        if (key == " ") {
            ship.shoot(boats);
        }

        if (key == "l") {
            ship.loadArtillery();
        }

        if (key == "h") {
            ship.hide();
        }

        if (key == "x") {
            HUD.style.display = HUD.style.display == "none" ? "block" : "none";
        }

        if (key == "p") {
            pauseDIV.style.display =
                pauseDIV.style.display == "none" ? "block" : "none";

            gameState =
                gameState == "GAME_PAUSED" ? "GAME_PLAYING" : "GAME_PAUSED";
        }

        if (key == "Escape") {
            overDIV.style.display = "block";
            gameState = "GAME_OVER";
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("keyup", keyup);
        }

        if (key == "r") {
            ship.reset();
        }

        if (key == "c") {
            cameraModeIDX = (cameraModeIDX + 1) % 3;
        }

        if (key == "m") {
            oceanAudio.muted = !oceanAudio.muted;
            shipAudio.muted = !shipAudio.muted;
            chestAudio.muted = !chestAudio.muted;
            reelingAudio.muted = !reelingAudio.muted;
            firingAudio.muted = !firingAudio.muted;
        }
    }

    function keyup(event) {
        const key = event.key;

        if (key == "ArrowUp" || key == "w") {
            ship.movement.forward = false;
        }

        if (key == "ArrowDown" || key == "s") {
            ship.movement.backward = false;
        }

        if (key == "ArrowLeft" || key == "a") {
            ship.movement.left = false;
        }

        if (key == "ArrowRight" || key == "d") {
            ship.movement.right = false;
        }

        if (key == "b") {
            ship.movement.boost = false;
        }
    }

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    document.removeEventListener("keydown", loadGame);
}

function render() {
    document.body.appendChild(renderer.domElement);
    gameState = "GAME_PLAYING";
}

function isColliding(object1, object2) {
    const delta = 25;
    const conditions = [
        Math.abs(object1.position.x - object2.position.x) < delta,
        Math.abs(object1.position.z - object2.position.z) < delta * 2,
    ];

    return conditions.every((condition) => condition);
}

function checkCollisions() {
    if (ship.ship)
        for (let i = 0; i < chests.length; ++i)
            if (diamonds.length)
                diamonds[i].isColliding = isColliding(
                    ship.ship,
                    chests[i].chest
                );

    if (boats.length == N_BOATS)
        for (let i = 0; i < boats.length; ++i)
            for (let j = 0; j < boats.length; ++j)
                if (i != j)
                    boats[i].isColliding = isColliding(
                        boats[i].boat,
                        boats[j].boat
                    );
}

function updateHUD() {
    if (ship.ship) {
        const zeroPad = (num, places) => String(num).padStart(places, "0");

        chestsLootedText = "Chests Looted: " + CHESTS_LOOTED + " / " + N_CHESTS;
        boatsDestroyedText =
            "Boats Destroyed: " + BOATS_DESTROYED + " / " + N_BOATS;
        timeText =
            "Time: " +
            zeroPad(Math.floor(timeElapsed / 3600), 2) +
            ":" +
            zeroPad(zeroPad(Math.floor(timeElapsed / 60), 2) % 60, 2);

        ammoText = "Ammo: " + ship.artillery.length;
        boostText =
            "Boost: " + (ship.boost > 100 ? 100 : ship.boost.toFixed(0));
        healthText = "Health: " + ship.health;
        distanceTravelledText =
            "Distance Travelled: " +
            (ship.distanceTravelled / 1000).toFixed(2) +
            " km";
        shipPositionText =
            "Ship Position: " +
            ship.ship.position.x.toFixed(1) +
            " " +
            ship.ship.position.y.toFixed(1) +
            " " +
            ship.ship.position.z.toFixed(1);
        shipRotationText =
            "Ship Rotation: " +
            zeroPad(
                Math.abs(((ship.ship.rotation.y * 180) / Math.PI).toFixed(1)) %
                    360,
                2
            ) +
            "??";

        HUD.innerHTML =
            chestsLootedText +
            "  ---  " +
            boatsDestroyedText +
            "  ---  " +
            timeText +
            "  ---  " +
            healthText +
            "  ---  " +
            boostText +
            "  ---  " +
            ammoText +
            "  ---  " +
            distanceTravelledText +
            "  ---  " +
            shipPositionText +
            "  ---  " +
            shipRotationText +
            "  ---  " +
            cameraModes[cameraModeIDX];
    }
}

function animate() {
    console.log("STATE: " + gameState + " --- ALERT: " + gameAlert);

    requestAnimationFrame(animate);

    if (gameState == "GAME_PLAYING") {
        if (ship.health <= 20) gameAlert = "CRITICAL HEALTH!";
        else if (ship.health <= 50) gameAlert = "LOW HEALTH!";
        else if (ship.artillery && ship.artillery.length == 0)
            gameAlert = "OUT OF AMMO!";
        else if (boats.every((boat) => boat.artillery.length == 0))
            gameAlert = "ENEMIES OUT OF AMMO!";
    }

    if (ship.isDestroyed) {
        setTimeout(() => {
            loseDIV.style.display = "block";
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("keyup", keyup);
        }, 1000);
        return;
    }

    if (BOATS_DESTROYED == N_BOATS || CHESTS_LOOTED == N_CHESTS) {
        setTimeout(() => {
            winDIV.style.display = "block";
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("keyup", keyup);
        }, 1000);
        return;
    }

    if (gameState != "GAME_PLAYING") return;

    timeElapsed += 1;

    ship.update();

    for (let i = 0; i < chests.length; i++) chests[i].update();

    for (let i = 0; i < diamonds.length; i++) {
        let status = diamonds[i].update(chests[i].chest.position);
        if (status == "chest_looted") {
            diamonds[i].remove();
            diamonds.splice(i, 1);

            chests[i].remove();
            chests.splice(i, 1);

            i--;
        }
    }

    for (let i = 0; i < boats.length; i++) if (ship.ship) boats[i].update(ship);

    if (ship.ship) {
        let newPosition = new THREE.Vector3();
        let newLookAt = new THREE.Vector3();

        camera.rotation.y = Math.PI - ship.ship.rotation.y;

        let cameraMode = cameraModes[cameraModeIDX];

        if (cameraMode == "First Person") {
            HUD.style.color = "black";

            newPosition.x =
                Math.cos(Math.PI - ship.ship.rotation.y) * 10 +
                ship.ship.position.x;
            newPosition.y = 40;
            newPosition.z =
                Math.sin(Math.PI - ship.ship.rotation.y) * 10 +
                ship.ship.position.z;

            newLookAt.x = -(
                Math.cos(Math.PI - ship.ship.rotation.y) * 1000 -
                ship.ship.position.x
            );
            newLookAt.y = 50;
            newLookAt.z = -(
                Math.sin(Math.PI - ship.ship.rotation.y) * 1000 -
                ship.ship.position.z
            );
        } else if (cameraMode == "Third Person") {
            HUD.style.color = "black";
            newPosition.x =
                Math.cos(Math.PI - ship.ship.rotation.y) * 200 +
                ship.ship.position.x;
            newPosition.y = 100;
            newPosition.z =
                Math.sin(Math.PI - ship.ship.rotation.y) * 200 +
                ship.ship.position.z;

            newLookAt.x = -(
                Math.cos(Math.PI - ship.ship.rotation.y) * 1000 -
                ship.ship.position.x
            );
            newLookAt.y = 50;
            newLookAt.z = -(
                Math.sin(Math.PI - ship.ship.rotation.y) * 1000 -
                ship.ship.position.z
            );
        } else if (cameraMode == "Bird's Eye") {
            HUD.style.color = "white";
            newPosition.x = ship.ship.position.x;
            newPosition.y = 400;
            newPosition.z = ship.ship.position.z;

            newLookAt.x =
                ship.ship.position.x - Math.cos(Math.PI - ship.ship.rotation.y);
            newLookAt.y = 50;
            newLookAt.z =
                ship.ship.position.z - Math.sin(Math.PI - ship.ship.rotation.y);
        }

        camera.position.set(newPosition.x, newPosition.y, newPosition.z);
        camera.lookAt(newLookAt.x, newLookAt.y, newLookAt.z);

        if (isPlayingShipAudio == false) {
            if (
                ship.movement.forward == true ||
                ship.movement.backward == true ||
                ship.movement.left == true ||
                ship.movement.right == true
            ) {
                shipAudio.volume = 0.5;
                shipAudio.play();
                isPlayingShipAudio = true;
            }
        } else if (isPlayingShipAudio == true) {
            if (
                ship.movement.forward == false &&
                ship.movement.backward == false &&
                ship.movement.left == false &&
                ship.movement.right == false
            ) {
                shipAudio.pause();

                isPlayingShipAudio = false;
            }
        }
    }

    checkCollisions();
    updateHUD();

    water.material.uniforms["time"].value += 1.0 / 60.0;

    renderer.render(scene, camera);
}
