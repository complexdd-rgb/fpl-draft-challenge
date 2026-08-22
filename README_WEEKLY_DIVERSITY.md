# Weekly top-answer diversity

The seven-day generator now keeps a batch-local count of each prompt's best-answer player by day. The first two appearances are allowed without penalty. A third or later day receives a rapidly increasing soft penalty during both weighted prompt selection and candidate-XI scoring. This reduces repeated weekly leaders without making generation impossible when exact-prompt rotation or other hard constraints leave limited choices.
