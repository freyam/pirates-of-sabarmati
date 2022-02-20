import "./style.css";

import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let camera, scene, renderer;
let controls, water, sun;
let timeElapsed = 0;

const SHIP_SPEED = 1.0;
const BOAT_SPEED = 0.75;

const loader = new GLTFLoader();

class Ship {
    constructor() {
        loader.load("textures/ship/scene.gltf", (gltf) => {
            const ship = gltf.scene;

            ship.scale.set(4, 4, 4);
            ship.position.set(0, -60, 0);
            ship.rotation.y = 0;

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
            };
        });
    }

    getPosition() {
        return this.boat.position;
    }

    getRotation() {
        return this.boat.rotation;
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

            this.ship.rotation.y += this.speed.rotation; // turn left-right
            this.ship.translateX(this.speed.velocity); // move forward-backward

            camera.rotation.x = 0;
            camera.translateX(this.speed.velocity); // move forward-backward
            camera.rotation.y += this.speed.rotation;
            camera.rotation.z = 0;
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    reset() {
        this.ship.position.set(0, -60, 0);
        this.ship.rotation.y = 0;
        this.ship.visible = true;
    }

    hide() {
        this.ship.visible = !this.ship.visible;
    }
}

const ship = new Ship();
class Boat {
    constructor(GLTFscene) {
        const boat = GLTFscene;

        let max = 500;
        let min = -max;

        let randomX = 0;
        let randomZ = 0;

        let shipX = 15;
        let shipZ = 15;

        while (
            Math.abs(randomX - shipX) <= 50 &&
            Math.abs(randomZ - shipZ) <= 25
        ) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
            randomZ = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        boat.scale.set(0.05, 0.05, 0.05);
        boat.position.set(randomX, 0, randomZ);

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
    }

    update(shipPosition, shipRotation) {
        this.speed.velocity = BOAT_SPEED;
        this.speed.rotation = 0.025;

        // console.log(
        //     "Ship Position " +
        //         shipPosition.x +
        //         " " +
        //         shipPosition.y +
        //         " " +
        //         shipPosition.z
        // );
        // console.log("Ship Direction " + shipRotation);
        // console.log(
        //     "Boat Position " +
        //         this.boat.position.x +
        //         " " +
        //         this.boat.position.y +
        //         " " +
        //         this.boat.position.z
        // );

        if (shipPosition.x > this.boat.position.x) {
            this.boat.translateX(this.speed.velocity);
        } else if (shipPosition.x < this.boat.position.x) {
            this.boat.translateX(-this.speed.velocity);
        }

        if (shipPosition.z > this.boat.position.z) {
            this.boat.translateZ(this.speed.velocity);
        } else if (shipPosition.z < this.boat.position.z) {
            this.boat.translateZ(-this.speed.velocity);
        }

        // rotate boat to face ship
        if (shipPosition.x > this.boat.position.x) {
            this.boat.rotation.y += this.speed.rotation;
        }

        if (shipPosition.x < this.boat.position.x) {
            this.boat.rotation.y -= this.speed.rotation;
        }

        if (shipPosition.z > this.boat.position.z) {
            this.boat.rotation.y += this.speed.rotation;
        }

        if (shipPosition.z < this.boat.position.z) {
            this.boat.rotation.y -= this.speed.rotation;
        }
    }

    stop() {
        this.speed.velocity = 0;
        this.speed.rotation = 0;
    }

    reset() {
        this.boat.position.set(15, -60, 60);
        this.boat.rotation.y = 0;
        this.boat.visible = true;
    }

    hide() {
        this.boat.visible = !this.boat.visible;
    }

    remove() {
        console.log("removing boat");
        scene.remove(this.boat);
    }
}

class Chest {
    constructor(GLTFscene) {
        const chest = GLTFscene;

        let max = 500;
        let min = -max;

        let randomX = 0;
        let randomZ = 0;

        let shipX = 15;
        let shipZ = 15;

        while (Math.abs(randomX - shipX) <= 50) {
            randomX = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        while (Math.abs(randomZ - shipZ) <= 25) {
            randomZ = Math.floor(Math.random() * (max - min + 1)) + min;
        }

        chest.scale.set(15, 15, 15);
        chest.position.set(randomX, 0, randomZ);

        scene.add(chest);

        this.chest = chest;
    }

    update() {
        if (this.chest) {
            this.chest.rotation.y += 0.01;
        }
    }

    remove() {
        scene.remove(this.chest);
    }
}

let dummyModel = null;

async function loadModel(URI) {
    return new Promise((resolve, reject) => {
        loader.load(URI, (gltf) => {
            resolve(gltf.scene);
        });
    });
}

let chests_looted = 0;

let chests = [];
const N_CHESTS = 0;

async function createChest() {
    if (!dummyModel) dummyModel = await loadModel("textures/chest/scene.gltf");
    return new Chest(dummyModel.clone());
}

let boats = [];
const N_BOATS = 3;

async function createBoat() {
    if (!dummyModel) dummyModel = await loadModel("textures/boat/scene.gltf");
    return new Boat(dummyModel.clone());
}

init();
animate();

async function init() {
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

    camera.position.set(40, 30, 50);

    camera.lookAt(scene.position);

    //

    sun = new THREE.Vector3();

    // Water

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

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
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined,
    });

    water.rotation.x = -Math.PI / 2;

    scene.add(water);

    // Skybox

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;

    skyUniforms["turbidity"].value = 10;
    skyUniforms["rayleigh"].value = 2;
    skyUniforms["mieCoefficient"].value = 0.005;
    skyUniforms["mieDirectionalG"].value = 0.8;

    const parameters = {
        elevation: 2,
        azimuth: 180,
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

    for (let i = 0; i < N_CHESTS; i++) {
        const chest = await createChest();
        chests.push(chest);
    }

    for (let i = 0; i < N_BOATS; i++) {
        const boat = await createBoat();
        boats.push(boat);
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

        if (key == " ") {
            ship.stop();
        }

        if (key == "h") {
            ship.hide();
        }

        if (key == "r") {
            ship.reset();
            camera.position.set(40, 60, 100);
            camera.lookAt(0, 0, 0);

            // for (let i = 0; i < N_BOATS; i++) {
            //     const boat = await createBoat();
            //     boats.push(boat);
            // }
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
    });
}

function isColliding(object1, object2) {
    const conditions = [
        object1.position.x - object2.position.x < 50,
        object1.position.x - object2.position.x > -50,
        object1.position.z - object2.position.z < 25,
        object1.position.z - object2.position.z > -25,
    ];

    return conditions.every((condition) => condition);
}

function checkCollisions() {
    if (ship.ship) {
        chests.forEach((chest) => {
            if (isColliding(ship.ship, chest.chest)) {
                chest.remove();
                chests_looted += 1;
                chests.splice(chests.indexOf(chest), 1);
            }
        });
    }
    if (ship.ship) {
        boats.forEach((boat) => {
            if (isColliding(ship.ship, boat.boat)) {
                boat.remove();
                boats.splice(boats.indexOf(boat), 1);
            }
        });
    }
}

function calculateOffset(position1, position2) {
    let offset = new THREE.Vector3();
    offset.addVectors(position1, position2).divideScalar(2);
    offset.y = position1.y;
    return offset;
}

function animate() {
    requestAnimationFrame(animate);

    timeElapsed += 1;

    ship.update();

    for (let i = 0; i < chests.length; i++) {
        chests[i].update();
    }

    for (let i = 0; i < boats.length; i++) {
        if (timeElapsed % 200 == 0) {
            boats[i].boat.rotation.y = -ship.ship.rotation.y;

            let offset = calculateOffset(
                boats[i].boat.position,
                ship.ship.position
            );

            boats[i].update(ship.ship.position, ship.ship.rotation.y);
        }
    }

    if (ship.ship) {
        let newPosition = new THREE.Vector3();

        newPosition.x =
            Math.cos(Math.PI - ship.ship.rotation.y) * 100 +
            ship.ship.position.x;
        newPosition.z =
            Math.sin(Math.PI - ship.ship.rotation.y) * 100 +
            ship.ship.position.z;
        newPosition.y = 40;

        camera.position.set(newPosition.x, newPosition.y, newPosition.z);

        newPosition.x =
            Math.cos(Math.PI - ship.ship.rotation.y) * 1000 -
            ship.ship.position.x;
        newPosition.z =
            Math.sin(Math.PI - ship.ship.rotation.y) * 1000 -
            ship.ship.position.z;
        newPosition.y = 40;

        camera.lookAt(-newPosition.x, newPosition.y, -newPosition.z);
    }

    water.material.uniforms["time"].value += 1.0 / 60.0;

    checkCollisions();

    renderer.render(scene, camera);
}
