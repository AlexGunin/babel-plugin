import './index.html';
import testModule from './scripts/module-a';

testModule.test();

// LOG
const someMethodDecorator = () => {}

class SomeClass {

    qwer = 10

    // LOG -l
    someMethod(a, b= 30) {
        const a1 = 10
        const b1 = 20

        return a + b + a1 + b1
    }
}
