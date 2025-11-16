import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function Board3D({ board, onCellClick, disabled, currentPlayer }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cellMeshesRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    scene.background = new THREE.Color(isDark ? 0x1a1a2e : 0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 7);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const gridSize = 3;
    const cellSize = 1;
    const spacing = 0.1;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      const x = (col - 1) * (cellSize + spacing);
      const z = (row - 1) * (cellSize + spacing);

      const geometry = new THREE.BoxGeometry(cellSize, 0.1, cellSize);
      const material = new THREE.MeshStandardMaterial({
        color: isDark ? 0x16213e : 0xdddddd,
        metalness: 0.3,
        roughness: 0.7
      });
      const cell = new THREE.Mesh(geometry, material);
      cell.position.set(x, 0, z);
      cell.receiveShadow = true;
      cell.userData = { index: i };
      scene.add(cell);
      cellMeshesRef.current.push(cell);
    }

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;

    scene.children.filter(child => child.userData.symbol).forEach(child => {
      scene.remove(child);
    });

    board.forEach((symbol, index) => {
      if (symbol) {
        const cellMesh = cellMeshesRef.current[index];
        if (!cellMesh) return;

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        if (symbol === 'X') {
          const group = new THREE.Group();
          const material = new THREE.MeshStandardMaterial({
            color: isDark ? 0xff6b6b : 0xff4444,
            metalness: 0.5,
            roughness: 0.5
          });

          const bar1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.6, 0.6),
            material
          );
          bar1.rotation.y = Math.PI / 4;
          bar1.castShadow = true;

          const bar2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.6, 0.6),
            material
          );
          bar2.rotation.y = -Math.PI / 4;
          bar2.castShadow = true;

          group.add(bar1);
          group.add(bar2);
          group.position.copy(cellMesh.position);
          group.position.y = 0.3;
          group.userData.symbol = 'X';
          scene.add(group);
        } else if (symbol === 'O') {
          const geometry = new THREE.TorusGeometry(0.25, 0.08, 16, 32);
          const material = new THREE.MeshStandardMaterial({
            color: isDark ? 0x4ecdc4 : 0x00aaff,
            metalness: 0.5,
            roughness: 0.5
          });
          const torus = new THREE.Mesh(geometry, material);
          torus.position.copy(cellMesh.position);
          torus.position.y = 0.3;
          torus.rotation.x = Math.PI / 2;
          torus.castShadow = true;
          torus.userData.symbol = 'O';
          scene.add(torus);
        }
      }
    });
  }, [board]);

  const handleClick = (event) => {
    if (disabled) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(cellMeshesRef.current);

    if (intersects.length > 0) {
      const index = intersects[0].object.userData.index;
      if (board[index] === '') {
        onCellClick(index);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="board-3d"
      onClick={handleClick}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    ></div>
  );
}

export default Board3D;
