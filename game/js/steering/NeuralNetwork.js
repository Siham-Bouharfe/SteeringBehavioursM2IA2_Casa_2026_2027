/**
 * NeuralNetwork.js
 * Neural network wrapper utilizing TensorFlow.js (tf) for Race Mode (Module 9/9b).
 * Supports copying, Gaussian weight mutation, tensor disposal, and predictions.
 */
class RaceNeuralNetwork {
  constructor(a, b, c, d) {
    if (typeof tf !== 'undefined' && a instanceof tf.Sequential) {
      this.model = a;
      this.input_nodes = b;
      this.hidden_nodes = c;
      this.output_nodes = d;
      this.useTf = true;
    } else if (typeof tf !== 'undefined') {
      this.input_nodes = a;
      this.hidden_nodes = b;
      this.output_nodes = c;
      this.useTf = true;
      this.model = this.createModel();
    } else {
      // Fallback matrix brain if TensorFlow.js is unavailable
      this.input_nodes = a;
      this.hidden_nodes = b;
      this.output_nodes = c;
      this.useTf = false;
      this.initMatrixBrain();
    }
  }

  createModel() {
    const model = tf.sequential();
    const hidden = tf.layers.dense({
      units: this.hidden_nodes,
      inputShape: [this.input_nodes],
      activation: 'sigmoid'
    });
    model.add(hidden);

    const output = tf.layers.dense({
      units: this.output_nodes,
      activation: 'sigmoid'
    });
    model.add(output);
    return model;
  }

  copy() {
    if (this.useTf) {
      return tf.tidy(() => {
        const modelCopy = this.createModel();
        const weights = this.model.getWeights();
        const weightCopies = [];
        for (let i = 0; i < weights.length; i++) {
          weightCopies[i] = weights[i].clone();
        }
        modelCopy.setWeights(weightCopies);
        return new RaceNeuralNetwork(modelCopy, this.input_nodes, this.hidden_nodes, this.output_nodes);
      });
    } else {
      const copy = new RaceNeuralNetwork(this.input_nodes, this.hidden_nodes, this.output_nodes);
      copy.wIH = this.wIH.map(row => [...row]);
      copy.wHO = this.wHO.map(row => [...row]);
      copy.bH = [...this.bH];
      copy.bO = [...this.bO];
      return copy;
    }
  }

  mutate(rate = 0.1) {
    if (this.useTf) {
      tf.tidy(() => {
        const weights = this.model.getWeights();
        const mutatedWeights = [];

        for (let i = 0; i < weights.length; i++) {
          const tensor = weights[i];
          const shape = tensor.shape;
          const values = tensor.dataSync().slice();

          for (let j = 0; j < values.length; j++) {
            if (Math.random() < rate) {
              const u1 = Math.max(1e-6, Math.random());
              const u2 = Math.random();
              const randNorm = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
              values[j] += randNorm * 0.5;
            }
          }

          mutatedWeights[i] = tf.tensor(values, shape);
        }
        this.model.setWeights(mutatedWeights);
      });
    } else {
      const mutateVal = (val) => {
        if (Math.random() < rate) {
          return val + (Math.random() * 0.6 - 0.3);
        }
        return val;
      };
      this.wIH = this.wIH.map(row => row.map(mutateVal));
      this.wHO = this.wHO.map(row => row.map(mutateVal));
      this.bH = this.bH.map(mutateVal);
      this.bO = this.bO.map(mutateVal);
    }
  }

  dispose() {
    if (this.useTf && this.model) {
      this.model.dispose();
    }
  }

  predict(inputs) {
    if (this.useTf) {
      return tf.tidy(() => {
        const xs = tf.tensor2d([inputs]);
        const ys = this.model.predict(xs);
        const outputs = ys.dataSync();
        return Array.from(outputs);
      });
    } else {
      // Matrix feedforward calculation
      const hidden = new Array(this.hidden_nodes);
      for (let j = 0; j < this.hidden_nodes; j++) {
        let sum = this.bH[j];
        for (let i = 0; i < this.input_nodes; i++) {
          sum += inputs[i] * this.wIH[j][i];
        }
        hidden[j] = 1 / (1 + Math.exp(-sum)); // sigmoid
      }

      const output = new Array(this.output_nodes);
      for (let k = 0; k < this.output_nodes; k++) {
        let sum = this.bO[k];
        for (let j = 0; j < this.hidden_nodes; j++) {
          sum += hidden[j] * this.wHO[k][j];
        }
        output[k] = 1 / (1 + Math.exp(-sum)); // sigmoid
      }
      return output;
    }
  }

  /* Fallback matrix initializer */
  initMatrixBrain() {
    this.wIH = Array.from({ length: this.hidden_nodes }, () =>
      Array.from({ length: this.input_nodes }, () => Math.random() * 2 - 1)
    );
    this.wHO = Array.from({ length: this.output_nodes }, () =>
      Array.from({ length: this.hidden_nodes }, () => Math.random() * 2 - 1)
    );
    this.bH = Array.from({ length: this.hidden_nodes }, () => Math.random() * 2 - 1);
    this.bO = Array.from({ length: this.output_nodes }, () => Math.random() * 2 - 1);
  }
}

