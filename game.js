import "./style.css";

import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let camera, scene, renderer, HUD;
let controls, water, sun;

let chestsLootedText,
    boatsDestroyedText,
    timeText,
    healthText,
    ammoText,
    shipPositionText,
    shipRotationText;

let timeElapsed = 0;

const SHIP_SPEED = 1.5;
const BOAT_SPEED = 1.0;
const DIMENSION = 100000;

let CHESTS_LOOTED = 0;
let BOATS_DESTROYED = 0;

let ship,
    chests = [],
    N_CHESTS = 30,
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
            this.health = 100;
            this.artillery = [];
            this.loadArtillery();
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

            if (this.movement.boost) {
                if (this.movement.forward || this.movement.backward) {
                    this.speed.velocity = this.speed.velocity * 2;
                }
                if (this.movement.left || this.movement.right) {
                    this.speed.rotation = this.speed.rotation * 2;
                }
            }

            this.ship.rotation.y += this.speed.rotation;
            this.ship.translateX(this.speed.velocity);

            camera.rotation.y += this.speed.rotation;
            camera.translateX(this.speed.velocity);
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
                new THREE.MeshBasicMaterial({ color: 0x3a3b3c })
            );

            while (this.artillery.length < N_CANNONBALLS) {
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

                console.log(list_of_boat_healths);

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

    hit() {}

    reset() {
        this.ship.position.set(0, -60, 0);
        this.ship.rotation.y = (90 * Math.PI) / 180;
        this.ship.visible = true;
    }

    hide() {
        this.ship.visible = !this.ship.visible;
    }
}

class Boat {
    constructor(GLTFscene) {
        const boat = GLTFscene;

        let max = DIMENSION / 50;
        let min = -DIMENSION / 50;

        let randomX = 0;
        let randomZ = 0;

        let shipX = 15;
        let shipZ = 15;

        while (
            Math.abs(randomX - shipX) <= DIMENSION / 500 &&
            Math.abs(randomZ - shipZ) <= DIMENSION / 500
        ) {
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
    }

    update(shipPosition) {
        if (this.health == 0) this.remove();

        let boatPosition = this.boat.position;

        let x = shipPosition.x - boatPosition.x;
        let z = shipPosition.z - boatPosition.z;

        let boatAngle = Math.PI - Math.atan2(z, x);

        this.boat.rotation.y = boatAngle;

        if (Math.abs(x) < DIMENSION / 1000 || Math.abs(z) < DIMENSION / 1000) {
            return;
        }

        if (shipPosition.x > boatPosition.x) {
            this.boat.position.x += 0.5;
        }
        if (shipPosition.x < boatPosition.x) {
            this.boat.position.x -= 0.5;
        }
        if (shipPosition.z > boatPosition.z) {
            this.boat.position.z += 0.5;
        }
        if (shipPosition.z < boatPosition.z) {
            this.boat.position.z -= 0.5;
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    shoot() {}

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

        let max = DIMENSION / 50;
        let min = -DIMENSION / 50;

        let randomX = 0;
        let randomZ = 0;

        let shipX = 15;
        let shipZ = 15;

        while (Math.abs(randomX - shipX) <= DIMENSION / 500) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        while (Math.abs(randomZ - shipZ) <= DIMENSION / 500) {
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

async function createCanonBall(shipPosition) {
    if (!dummyModel)
        dummyModel = await loadModel("textures/cannonball/scene.gltf");
    return new Canonball(dummyModel.clone(), shipPosition);
}

// banner();
init();
animate();

function banner() {
    let banner = document.getElementById("banner");
    let color;
    let isBlack = true;
    let intervalID = setInterval(() => {
        color = isBlack
            ? "#" + Math.floor(Math.random() * 16777215).toString(16)
            : "black";
        isBlack = !isBlack;
        banner.style.transition = "background-color 2s";
        banner.style.backgroundColor = color;
    }, 1000);

    document.addEventListener("keydown", (event) => {
        if (event.key == " ") {
            clearInterval(intervalID);
            banner.style.backgroundImage = "url(assets/banner.png)";
            banner.style.transition =
                "background-image 1s, background-color 2s";
            banner.style.backgroundColor = "black";
        }

        setTimeout(() => {
            banner.style.display = "none";
        }, 3000);
    });
}

async function init() {
    HUD = document.createElement("div");
    HUD.style.padding = "10px";
    HUD.style.display = "block";
    HUD.style.color = "white";
    HUD.style.position = "absolute";
    HUD.style.top = "0";
    HUD.style.left = "0";
    HUD.style.fontSize = "15px";

    document.body.appendChild(HUD);

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);

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
    skyUniforms["rayleigh"].value = 1;
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

    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 10, 0);
    controls.minDistance = 100.0;
    controls.maxDistance = 400.0;
    controls.update();

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

    window.addEventListener("keydown", function (event) {
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

        if (key == "r") {
            ship.reset();
        }

        if (key == "m") {
            oceanAudio.muted = !oceanAudio.muted;
            shipAudio.muted = !shipAudio.muted;
            chestAudio.muted = !chestAudio.muted;
            reelingAudio.muted = !reelingAudio.muted;
            firingAudio.muted = !firingAudio.muted;
        }
    });

    window.addEventListener("keyup", function (event) {
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
    });
}

function isColliding(object1, object2) {
    const delta = 50;
    const conditions = [
        Math.abs(object1.position.x - object2.position.x) < delta,
        Math.abs(object1.position.z - object2.position.z) < delta,
    ];

    return conditions.every((condition) => condition);
}

function checkCollisions() {
    if (ship.ship)
        for (let i = 0; i < chests.length; ++i)
            if (diamonds[i].diamond)
                diamonds[i].isColliding = isColliding(
                    ship.ship,
                    chests[i].chest
                );
}

function updateHUD() {
    const zeroPad = (num, places) => String(num).padStart(places, "0");

    chestsLootedText = "Chests Looted: " + CHESTS_LOOTED + " / " + N_CHESTS;
    boatsDestroyedText =
        "Boats Destroyed: " + BOATS_DESTROYED + " / " + N_BOATS;
    timeText =
        "Time: " +
        zeroPad(Math.floor(timeElapsed / 3600), 2) +
        ":" +
        zeroPad(zeroPad(Math.floor(timeElapsed / 60), 2) % 60, 2);
    healthText = "Health: " + ship.health;
    ammoText = "Ammo: " + ship.artillery.length;
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
            Math.abs(((ship.ship.rotation.y * 180) / Math.PI).toFixed(1)) % 360,
            2
        ) +
        "°";

    HUD.innerHTML =
        chestsLootedText +
        "  ---  " +
        boatsDestroyedText +
        "  ---  " +
        timeText +
        "  ---  " +
        healthText +
        "  ---  " +
        ammoText +
        "  ---  " +
        shipPositionText +
        "  ---  " +
        shipRotationText;
}

function animate() {
    requestAnimationFrame(animate);

    timeElapsed += 1;

    ship.update();

    for (let i = 0; i < chests.length; i++) {
        chests[i].update();
    }

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

    for (let i = 0; i < boats.length; i++) {
        if (ship.ship) boats[i].update(ship.ship.position);
    }

    if (ship.ship) {
        let newPosition = new THREE.Vector3();
        newPosition.x =
            Math.cos(Math.PI - ship.ship.rotation.y) * 100 +
            ship.ship.position.x;
        newPosition.y = 50;
        newPosition.z =
            Math.sin(Math.PI - ship.ship.rotation.y) * 100 +
            ship.ship.position.z;

        let newLookAt = new THREE.Vector3();
        newLookAt.x = -(
            Math.cos(Math.PI - ship.ship.rotation.y) * 1000 -
            ship.ship.position.x
        );
        newLookAt.y = 50;
        newLookAt.z = -(
            Math.sin(Math.PI - ship.ship.rotation.y) * 1000 -
            ship.ship.position.z
        );

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
