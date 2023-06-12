const babelTypes = require('@babel/types')

const checkIsLog = (node) => node.value.trimStart().startsWith('LOG')

const parseFlags = (node) => {
    const flags = [...node.value.matchAll(/-\w+/gi)]
    const value = flags.length ? flags.map(flag => flag[0]) : []

    return new Set(value)
}

const getThisProperty = (key) => babelTypes.memberExpression(babelTypes.thisExpression(), babelTypes.identifier(key))

const createGetter = (getterId, key, extraBody) => babelTypes.classMethod('get',babelTypes.identifier(getterId),[], babelTypes.blockStatement([
    ...extraBody,
    babelTypes.returnStatement(getThisProperty(key))
]))

const createSetter = (setterId, key, before, after) => babelTypes.classMethod('set',babelTypes.identifier(setterId),[babelTypes.identifier('value')], babelTypes.blockStatement([
    ...before,
    babelTypes.expressionStatement(babelTypes.assignmentExpression('=', getThisProperty(key), babelTypes.identifier('value'))),
    ...after
]))

const createLogNode = (arguments) => babelTypes.expressionStatement(
    babelTypes.callExpression(
        babelTypes.memberExpression(
            babelTypes.identifier('console'),
            babelTypes.identifier('log')
        ),
        arguments
    )
)

const createGetterWithLog = (getterName, key) => createGetter(getterName, key, [
    createLogNode([babelTypes.stringLiteral(`GET ${key}`), getThisProperty(key)])
])

const createSetterWithLog = (setterName, key) =>  createSetter(setterName, key, [
    createLogNode([babelTypes.stringLiteral(`BEFORE ASSIGNMENT ${key}`), getThisProperty(key)])
], [
    createLogNode([babelTypes.stringLiteral(`AFTER ASSIGNMENT ${key}`), getThisProperty(key)])
])

const createVariableLog = (node) => {
    const variableName = node.declarations[0].id.name
    return createLogNode([babelTypes.stringLiteral(variableName.toUpperCase()), babelTypes.identifier(variableName)])
}

const createArgumentLog = (node) => {
    const variableName = babelTypes.isAssignmentPattern(node) ? node.left.name : node.name
    return createLogNode([babelTypes.stringLiteral(variableName.toUpperCase()), babelTypes.identifier(variableName)])
}

const createVariableDeclaration = (value) => babelTypes.variableDeclaration('const', [babelTypes.variableDeclarator(babelTypes.identifier('METHOD_CUSTOM_RESULT'), value)])

const handleClassMethod = (node) => {
    const resultBody = node.params.map(createArgumentLog) ?? []

    node.body.body.forEach((funcNode) => {
        if(babelTypes.isVariableDeclaration(funcNode)) {
            resultBody.push(funcNode)
            resultBody.push(createVariableLog(funcNode))
        }

        if(babelTypes.isReturnStatement(funcNode)) {
            resultBody.push(createLogNode(
                [
                    babelTypes.stringLiteral('METHOD_CUSTOM_RESULT'),
                    funcNode.argument]))

            resultBody.push(funcNode)

        }
    })

    node.body.body = resultBody

    return node
}

const handleClassProperty = (node) => {
    const dashedName = `_${node.key.name}`
    const dashedProperty = babelTypes.classProperty(babelTypes.identifier(dashedName), node.value)
    const getter = createGetterWithLog(node.key.name, dashedName)
    const setter = createSetterWithLog(node.key.name, dashedName)

    return [dashedProperty, getter, setter]
}

const HANDLERS = {
    isClassMethod: handleClassMethod,
    isClassProperty: handleClassProperty
}

const handleClassBody = (body) => {
    const newClassBody = body.reduce((acc, node) => {

        for (const key in HANDLERS) {
            const isCurrentType = babelTypes[key](node)
            if(!isCurrentType) continue

            const handler = HANDLERS[key]
            const resultTransformation = handler(node)

            return Array.isArray(resultTransformation) ? [...acc, ...resultTransformation] : [...acc, resultTransformation]
        }

        return [...acc, node]

    }, [])

    return newClassBody
}

const ClassMethodsDecorator = {
    ClassDeclaration(path) {
        const logComment = path.node.leadingComments.find(checkIsLog)
        if(logComment) {
            // const flags = parseFlags(logComment)

            path.node.body.body = handleClassBody(path.node.body.body)
        }
    }
}


module.exports = () => ({
    visitor: ClassMethodsDecorator
})
